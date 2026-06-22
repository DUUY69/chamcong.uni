using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Models;
using WorkforceManagement.Api.Models.Payroll;
using WorkforceManagement.Api.Services;

namespace WorkforceManagement.Api.Controllers;

[ApiController]
[Route("api/payrolls")]
[Authorize]
public class PayrollsController : ControllerBase
{
	private readonly PayrollService _svc;

	private readonly AppDbContext _db;

	private int CurrentUserId => int.Parse(base.User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ?? "0");

	private int? EmployeeId
	{
		get
		{
			string s = base.User.FindFirstValue("employeeId");
			if (!int.TryParse(s, out var result) || result <= 0)
			{
				return null;
			}
			return result;
		}
	}

	public PayrollsController(PayrollService svc, AppDbContext db)
	{
		_svc = svc;
		_db = db;
	}

	[HttpGet("my")]
	[Authorize(Roles = "Employee")]
	public async Task<IActionResult> GetMy()
	{
		if (!EmployeeId.HasValue)
		{
			return Ok(ApiResponse<List<PayrollDto>>.Ok(new List<PayrollDto>()));
		}
		List<PayrollDto> data = (await (from d in _db.PayrollDetails.Include((PayrollDetail d) => d.Payroll).ThenInclude((Payroll p) => p.Store).Include((PayrollDetail d) => d.Employee)
			where d.EmployeeId == EmployeeId.Value && (d.Payroll.Status == "Approved" || d.Payroll.Status == "Paid")
			orderby d.Payroll.Year descending, d.Payroll.Month descending
			select d).ToListAsync()).Select((PayrollDetail d) => new PayrollDto
		{
			Id = d.PayrollId,
			StoreId = d.Payroll.StoreId,
			StoreName = (d.Payroll.Store?.Name ?? ""),
			Month = d.Payroll.Month,
			Year = d.Payroll.Year,
			Status = d.Payroll.Status,
			TotalAmount = d.NetSalary,
			CreatedAt = d.Payroll.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
			Details = new List<PayrollDetailDto> { MapDetail(d) }
		}).ToList();
		return Ok(ApiResponse<List<PayrollDto>>.Ok(data));
	}

	[HttpGet]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> GetAll([FromQuery] int? storeId, [FromQuery] int? month, [FromQuery] int? year, [FromQuery] string? status)
	{
		UserStoreScope scope = new UserStoreScope(_db, base.User);
		bool hasValue = storeId.HasValue;
		bool flag = hasValue;
		if (flag)
		{
			flag = !(await scope.IsStoreFilterAllowedAsync(storeId));
		}
		if (flag)
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền xem cửa hàng này."));
		}
		List<PayrollDto> list = await _svc.GetAllAsync(storeId, month, year, status);
		List<int> managedStoreIds = await scope.GetManagedStoreIdsAsync();
		if (managedStoreIds != null)
		{
			list = list.Where((PayrollDto p) => managedStoreIds.Contains(p.StoreId)).ToList();
		}
		return Ok(ApiResponse<List<PayrollDto>>.Ok(list));
	}

	[HttpGet("{id:int}")]
	[Authorize(Roles = "Admin,Manager,Employee")]
	public async Task<IActionResult> GetById(int id)
	{
		_ = 1;
		try
		{
			PayrollDto dto = await _svc.GetByIdAsync(id);
			string text = base.User.FindFirstValue("http://schemas.microsoft.com/ws/2008/06/identity/claims/role") ?? "";
			if (text == "Employee")
			{
				if (!EmployeeId.HasValue)
				{
					return StatusCode(403, ApiResponse.Fail("Không có quyền."));
				}
				string status = dto.Status;
				if ((!(status == "Approved") && !(status == "Paid")) || 1 == 0)
				{
					return StatusCode(403, ApiResponse.Fail("Phiếu lương chưa được duyệt."));
				}
				PayrollDetailDto payrollDetailDto = dto.Details.FirstOrDefault((PayrollDetailDto d) => d.EmployeeId == EmployeeId.Value);
				if (payrollDetailDto == null)
				{
					return StatusCode(403, ApiResponse.Fail("Không có quyền xem bảng lương này."));
				}
				dto.Details = new List<PayrollDetailDto> { payrollDetailDto };
				dto.TotalAmount = payrollDetailDto.NetSalary;
				return Ok(ApiResponse<PayrollDto>.Ok(dto));
			}
			UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
			if (!(await userStoreScope.CanAccessStoreAsync(dto.StoreId)))
			{
				return StatusCode(403, ApiResponse.Fail("Không có quyền xem bảng lương này."));
			}
			return Ok(ApiResponse<PayrollDto>.Ok(dto));
		}
		catch (KeyNotFoundException)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy bảng lương."));
		}
	}

	[HttpPost("generate")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> Generate([FromBody] GeneratePayrollDto dto)
	{
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		if (!(await userStoreScope.CanAccessStoreAsync(dto.StoreId)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền tính lương cửa hàng này."));
		}
		try
		{
			return Ok(ApiResponse<PayrollDto>.Ok(await _svc.GenerateAsync(dto, CurrentUserId), "Tạo bảng lương thành công."));
		}
		catch (InvalidOperationException ex)
		{
			return BadRequest(ApiResponse.Fail(ex.Message));
		}
	}

	[HttpPatch("{id:int}/approve")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> Approve(int id)
	{
		if (!(await CanAccessPayrollAsync(id)))
		{
			return PayrollForbidden();
		}
		try
		{
			return Ok(ApiResponse<PayrollDto>.Ok(await _svc.ApproveAsync(id, CurrentUserId), "Đã duyệt bảng lương."));
		}
		catch (Exception ex)
		{
			return BadRequest(ApiResponse.Fail(ex.Message));
		}
	}

	[HttpPatch("{id:int}/pay")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> MarkPaid(int id)
	{
		if (!(await CanAccessPayrollAsync(id)))
		{
			return PayrollForbidden();
		}
		try
		{
			return Ok(ApiResponse<PayrollDto>.Ok(await _svc.MarkPaidAsync(id, CurrentUserId), "Đã đánh dấu đã trả lương."));
		}
		catch (Exception ex)
		{
			return BadRequest(ApiResponse.Fail(ex.Message));
		}
	}

	[HttpPut("{id:int}/details/{detailId:int}")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> UpdateDetail(int id, int detailId, [FromBody] UpdatePayrollDetailDto dto)
	{
		if (!(await CanAccessPayrollAsync(id)))
		{
			return PayrollForbidden();
		}
		try
		{
			await _svc.UpdateDetailAsync(id, detailId, dto);
			return Ok(ApiResponse.Ok("Cập nhật thành công."));
		}
		catch (Exception ex)
		{
			return BadRequest(ApiResponse.Fail(ex.Message));
		}
	}

	private async Task<bool> CanAccessPayrollAsync(int payrollId)
	{
		int num = await (from p in _db.Payrolls
			where p.Id == payrollId
			select p.StoreId).FirstOrDefaultAsync();
		if (num == 0)
		{
			return false;
		}
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		return await userStoreScope.CanAccessStoreAsync(num);
	}

	private static IActionResult PayrollForbidden()
	{
		return new ObjectResult(ApiResponse.Fail("Không có quyền thao tác bảng lương này."))
		{
			StatusCode = 403
		};
	}

	private static PayrollDetailDto MapDetail(PayrollDetail d)
	{
		return new PayrollDetailDto
		{
			Id = d.Id,
			EmployeeId = d.EmployeeId,
			EmployeeName = (d.Employee?.FullName ?? ""),
			EmployeeCode = (d.Employee?.EmployeeCode ?? ""),
			BankAccountNo = d.Employee?.BankAccountNo,
			BankName = d.Employee?.BankName,
			BankAccountName = d.Employee?.BankAccountName,
			WorkedDays = d.WorkedDays,
			WorkedHours = d.WorkedHours,
			OvertimeHours = d.OvertimeHours,
			BaseSalaryPerHour = d.BaseSalaryPerHour,
			Coefficient = d.Coefficient,
			GrossSalary = d.GrossSalary,
			Bonus = d.Bonus,
			DeliveryAllowance = d.DeliveryAllowance,
			InsuranceDeduction = d.InsuranceDeduction,
			Deduction = d.Deduction,
			NetSalary = d.NetSalary,
			Note = d.Note
		};
	}
}
