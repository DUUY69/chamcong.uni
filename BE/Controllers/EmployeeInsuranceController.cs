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
using WorkforceManagement.Api.Models.Employee;

namespace WorkforceManagement.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class EmployeeInsuranceController : ControllerBase
{
	private readonly AppDbContext _db;

	private int CurrentUserId => int.Parse(base.User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ?? "0");

	private string Role => base.User.FindFirstValue("http://schemas.microsoft.com/ws/2008/06/identity/claims/role") ?? "";

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

	private bool CanManage
	{
		get
		{
			string role = Role;
			if (role == "Admin" || role == "Manager")
			{
				return true;
			}
			return false;
		}
	}

	public EmployeeInsuranceController(AppDbContext db)
	{
		_db = db;
	}

	[HttpGet("employees/{employeeId:int}/insurance")]
	public async Task<IActionResult> GetInsurance(int employeeId)
	{
		if (!(await CanAccessEmployeeAsync(employeeId)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền."));
		}
		EmployeeInsurance employeeInsurance = await _db.EmployeeInsurances.Include((EmployeeInsurance x) => x.InsuranceRate).FirstOrDefaultAsync((EmployeeInsurance x) => x.EmployeeId == employeeId);
		return Ok(ApiResponse<EmployeeInsuranceDto>.Ok((employeeInsurance == null) ? new EmployeeInsuranceDto
		{
			EmployeeId = employeeId,
			Mode = "None"
		} : MapInsurance(employeeInsurance)));
	}

	[HttpPut("employees/{employeeId:int}/insurance")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> UpsertInsurance(int employeeId, [FromBody] UpsertEmployeeInsuranceDto dto)
	{
		if (!(await _db.Employees.AnyAsync((Employee e) => e.Id == employeeId)))
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy nhân viên."));
		}
		string mode = NormalizeMode(dto.Mode);
		decimal premium = default(decimal);
		int? rateId = null;
		if (mode == "CompanyProvided")
		{
			if (!dto.InsuranceRateId.HasValue)
			{
				return BadRequest(ApiResponse.Fail("Chọn mức trừ BH do Admin cấu hình."));
			}
			InsuranceRate insuranceRate = await _db.InsuranceRates.FindAsync(dto.InsuranceRateId.Value);
			if (insuranceRate == null || !insuranceRate.IsActive)
			{
				return BadRequest(ApiResponse.Fail("Mức trừ BH không hợp lệ hoặc đã tắt."));
			}
			rateId = insuranceRate.Id;
			premium = insuranceRate.Amount;
		}
		else if (mode == "SelfPaid")
		{
			premium = default(decimal);
		}
		EmployeeInsurance row = await _db.EmployeeInsurances.FindAsync(employeeId);
		if (row == null)
		{
			row = new EmployeeInsurance
			{
				EmployeeId = employeeId
			};
			_db.EmployeeInsurances.Add(row);
		}
		row.Mode = mode;
		row.InsuranceRateId = rateId;
		row.MonthlyPremium = premium;
		row.BhxhNumber = (string.IsNullOrWhiteSpace(dto.BhxhNumber) ? null : dto.BhxhNumber.Trim());
		row.Note = (string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim());
		row.UpdatedAt = DateTime.UtcNow;
		row.UpdatedBy = CurrentUserId;
		await _db.SaveChangesAsync();
		await _db.Entry(row).Reference((EmployeeInsurance x) => x.InsuranceRate).LoadAsync();
		return Ok(ApiResponse<EmployeeInsuranceDto>.Ok(MapInsurance(row), "Đã lưu cấu hình bảo hiểm."));
	}

	[HttpGet("employees/{employeeId:int}/insurance-expenses")]
	public async Task<IActionResult> GetExpenses(int employeeId, [FromQuery] int? year)
	{
		if (!(await CanAccessEmployeeAsync(employeeId)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền."));
		}
		IQueryable<EmployeeInsuranceExpense> source = from x in _db.EmployeeInsuranceExpenses.Include((EmployeeInsuranceExpense x) => x.Employee)
			where x.EmployeeId == employeeId
			select x;
		if (year.HasValue)
		{
			source = source.Where((EmployeeInsuranceExpense x) => x.Year == ((int?)year).Value);
		}
		return Ok(ApiResponse<List<EmployeeInsuranceExpenseDto>>.Ok((await (from x in source
			orderby x.Year descending, x.Month descending
			select x).ToListAsync()).Select(MapExpense).ToList()));
	}

	[HttpPost("employees/{employeeId:int}/insurance-expenses")]
	public async Task<IActionResult> UpsertExpense(int employeeId, [FromBody] UpsertInsuranceExpenseDto dto)
	{
		if (!(await CanAccessEmployeeAsync(employeeId)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền."));
		}
		if ((await _db.EmployeeInsurances.FindAsync(employeeId))?.Mode != "SelfPaid" && !CanManage)
		{
			return BadRequest(ApiResponse.Fail("Chỉ NV tự mua BH mới ghi chi phí tự trả."));
		}
		int month = dto.Month;
		bool flag = ((month < 1 || month > 12) ? true : false);
		if (flag || dto.Year < 2000)
		{
			return BadRequest(ApiResponse.Fail("Tháng/năm không hợp lệ."));
		}
		if (dto.Amount <= 0m)
		{
			return BadRequest(ApiResponse.Fail("Nhập số tiền chi phí BH tự trả."));
		}
		EmployeeInsuranceExpense row = await _db.EmployeeInsuranceExpenses.FirstOrDefaultAsync((EmployeeInsuranceExpense x) => x.EmployeeId == employeeId && x.Year == dto.Year && x.Month == dto.Month);
		if (row == null)
		{
			row = new EmployeeInsuranceExpense
			{
				EmployeeId = employeeId,
				Year = dto.Year,
				Month = dto.Month,
				CreatedBy = CurrentUserId
			};
			_db.EmployeeInsuranceExpenses.Add(row);
		}
		row.Amount = dto.Amount;
		row.Note = (string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim());
		await _db.SaveChangesAsync();
		await _db.Entry(row).Reference((EmployeeInsuranceExpense x) => x.Employee).LoadAsync();
		return Ok(ApiResponse<EmployeeInsuranceExpenseDto>.Ok(MapExpense(row), "Đã lưu chi phí BH tự trả."));
	}

	[HttpGet("reports/insurance-self-paid")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> SelfPaidReport([FromQuery] int year, [FromQuery] int? month)
	{
		if (year < 2000)
		{
			return BadRequest(ApiResponse.Fail("Năm không hợp lệ."));
		}
		IQueryable<EmployeeInsuranceExpense> source = from x in _db.EmployeeInsuranceExpenses.Include((EmployeeInsuranceExpense x) => x.Employee)
			where x.Year == year
			select x;
		if (month.HasValue)
		{
			source = source.Where((EmployeeInsuranceExpense x) => x.Month == ((int?)month).Value);
		}
		List<InsuranceSelfPaidReportRowDto> data = (await (from x in source
			orderby x.Month, x.Employee.EmployeeCode
			select x).ToListAsync()).Select((EmployeeInsuranceExpense x) => new InsuranceSelfPaidReportRowDto
		{
			EmployeeId = x.EmployeeId,
			EmployeeCode = (x.Employee?.EmployeeCode ?? ""),
			EmployeeName = (x.Employee?.FullName ?? ""),
			Year = x.Year,
			Month = x.Month,
			Amount = x.Amount,
			Note = x.Note
		}).ToList();
		return Ok(ApiResponse<List<InsuranceSelfPaidReportRowDto>>.Ok(data));
	}

	private async Task<bool> CanAccessEmployeeAsync(int employeeId)
	{
		if (CanManage)
		{
			return true;
		}
		return EmployeeId == employeeId;
	}

	private static string NormalizeMode(string? mode)
	{
		if (!(mode == "CompanyProvided"))
		{
			if (mode == "SelfPaid")
			{
				return "SelfPaid";
			}
			return "None";
		}
		return "CompanyProvided";
	}

	private static EmployeeInsuranceDto MapInsurance(EmployeeInsurance x)
	{
		return new EmployeeInsuranceDto
		{
			EmployeeId = x.EmployeeId,
			Mode = x.Mode,
			MonthlyPremium = x.MonthlyPremium,
			InsuranceRateId = x.InsuranceRateId,
			InsuranceRateCode = x.InsuranceRate?.Code,
			InsuranceRateLabel = x.InsuranceRate?.Label,
			BhxhNumber = x.BhxhNumber,
			Note = x.Note,
			UpdatedAt = x.UpdatedAt.ToString("yyyy-MM-dd HH:mm")
		};
	}

	private static EmployeeInsuranceExpenseDto MapExpense(EmployeeInsuranceExpense x)
	{
		return new EmployeeInsuranceExpenseDto
		{
			Id = x.Id,
			EmployeeId = x.EmployeeId,
			EmployeeName = (x.Employee?.FullName ?? ""),
			EmployeeCode = (x.Employee?.EmployeeCode ?? ""),
			Year = x.Year,
			Month = x.Month,
			Amount = x.Amount,
			Note = x.Note,
			CreatedAt = x.CreatedAt.ToString("yyyy-MM-dd HH:mm")
		};
	}
}
