using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Threading.Tasks;
using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Models;
using WorkforceManagement.Api.Models.Employee;
using WorkforceManagement.Api.Services;

namespace WorkforceManagement.Api.Controllers;

[ApiController]
[Route("api/employees")]
[Authorize]
public class EmployeesController : ControllerBase
{
	private readonly AppDbContext _db;

	private int CurrentUserId => int.Parse(base.User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ?? "0");

	private string Role => base.User.FindFirstValue("http://schemas.microsoft.com/ws/2008/06/identity/claims/role") ?? "";

	private bool IsAdmin => Role == "Admin";

	private bool IsManager => Role == "Manager";

	private bool CanManageSalary
	{
		get
		{
			if (!IsAdmin)
			{
				return IsManager;
			}
			return true;
		}
	}

	public EmployeesController(AppDbContext db)
	{
		_db = db;
	}

	[HttpGet]
	public async Task<IActionResult> GetAll([FromQuery] int? storeId, [FromQuery] bool? isActive)
	{
		UserStoreScope scope = new UserStoreScope(_db, base.User);
		List<int> managedStoreIds = await scope.GetManagedStoreIdsAsync();
		if (managedStoreIds != null && managedStoreIds.Count == 0)
		{
			return Ok(ApiResponse<List<EmployeeDto>>.Ok(new List<EmployeeDto>()));
		}
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
		IQueryable<Employee> source = _db.Employees.Include((Employee e) => e.User).Include((Employee e) => e.PrimaryStore).Include((Employee e) => e.EmployeeStores)
			.ThenInclude((EmployeeStore es) => es.Store)
			.Include((Employee e) => e.SalaryCoefficients)
			.AsQueryable();
		if (managedStoreIds != null)
		{
			source = source.Where((Employee e) => e.EmployeeStores.Any((EmployeeStore es) => managedStoreIds.Contains(es.StoreId)));
		}
		if (storeId.HasValue)
		{
			source = source.Where((Employee e) => e.EmployeeStores.Any((EmployeeStore es) => es.StoreId == ((int?)storeId).Value));
		}
		if (isActive.HasValue)
		{
			source = source.Where((Employee e) => e.IsActive == ((bool?)isActive).Value);
		}
		else if (Role == "Manager")
		{
			source = source.Where((Employee e) => e.IsActive);
		}
		return Ok(ApiResponse<List<EmployeeDto>>.Ok((await source.OrderBy((Employee e) => e.FullName).ToListAsync()).Select(MapDto).ToList()));
	}

	[HttpGet("list-stats")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> GetListStats()
	{
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		List<int> managedStoreIds = await userStoreScope.GetManagedStoreIdsAsync();
		int totalInDb = await _db.Employees.CountAsync();
		int totalUsers = await _db.Users.CountAsync();
		int orphans = await _db.Users.CountAsync((User u) => !_db.Employees.Any((Employee e) => e.UserId == u.Id));
		int employeesVisibleToYou = ((managedStoreIds == null) ? totalInDb : ((managedStoreIds.Count != 0) ? (await _db.Employees.CountAsync((Employee e) => e.EmployeeStores.Any((EmployeeStore es) => managedStoreIds.Contains(es.StoreId)))) : 0));
		return Ok(ApiResponse<object>.Ok(new
		{
			employeesInDatabase = totalInDb,
			employeesVisibleToYou = employeesVisibleToYou,
			usersInDatabase = totalUsers,
			orphanUsers = orphans,
			note = "Danh sách NV chỉ hiện Employees (hồ sơ nhân viên). Bảng Users còn có tài khoản QL (PASSION.*, admin) — không nằm trong danh sách NV trừ khi có hồ sơ Employee."
		}));
	}

	[HttpGet("{id:int}")]
	public async Task<IActionResult> GetById(int id)
	{
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		if (!(await userStoreScope.CanAccessEmployeeAsync(id)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền xem nhân viên này."));
		}
		Employee employee = await _db.Employees.Include((Employee x) => x.User).Include((Employee x) => x.PrimaryStore).Include((Employee x) => x.EmployeeStores)
			.ThenInclude((EmployeeStore es) => es.Store)
			.Include((Employee x) => x.SalaryCoefficients)
			.FirstOrDefaultAsync((Employee x) => x.Id == id);
		if (employee == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy nhân viên."));
		}
		return Ok(ApiResponse<EmployeeDto>.Ok(MapDto(employee)));
	}

	[HttpGet("check-availability")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> CheckAvailability([FromQuery] string? username, [FromQuery] string? email)
	{
		object uInfo = null;
		object eInfo = null;
		if (!string.IsNullOrWhiteSpace(username))
		{
			User user = await FindUserByUsernameAsync(username);
			if (user != null)
			{
				uInfo = MapConflictUser(user);
			}
		}
		if (!string.IsNullOrWhiteSpace(email))
		{
			string em = email.Trim();
			User user2 = await _db.Users.Include((User x) => x.Employee).FirstOrDefaultAsync((User x) => x.Email.ToLower() == em.ToLower());
			if (user2 != null)
			{
				eInfo = MapConflictUser(user2);
			}
		}
		return Ok(ApiResponse<object>.Ok(new
		{
			usernameAvailable = (uInfo == null),
			emailAvailable = (eInfo == null),
			usernameConflict = uInfo,
			emailConflict = eInfo
		}));
	}

	[HttpPost]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> Create([FromBody] CreateEmployeeDto dto)
	{
		List<string> list = new List<string>();
		if (string.IsNullOrWhiteSpace(dto.FullName))
		{
			list.Add("Họ tên không được để trống.");
		}
		if (string.IsNullOrWhiteSpace(dto.Username))
		{
			list.Add("Username không được để trống.");
		}
		if (string.IsNullOrWhiteSpace(dto.Email))
		{
			list.Add("Email không được để trống.");
		}
		if (string.IsNullOrWhiteSpace(dto.Password))
		{
			list.Add("Mật khẩu không được để trống.");
		}
		if (list.Any())
		{
			return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ.", list));
		}
		string username = dto.Username.Trim();
		string email = dto.Email.Trim();
		if (IsManager && dto.Role == "Manager")
		{
			return BadRequest(ApiResponse.Fail("Quản lý cửa hàng chỉ được tạo nhân viên (không tạo tài khoản Quản lý)."));
		}
		string error;
		int? primaryStoreId = ResolvePrimaryStoreId(dto.PrimaryStoreId, dto.StoreIds, dto.Role, out error);
		if (error != null)
		{
			return BadRequest(ApiResponse.Fail(error));
		}
		if (IsManager)
		{
			UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
			if (!(await userStoreScope.CanAccessStoreAsync(primaryStoreId.Value)))
			{
				return StatusCode(403, ApiResponse.Fail("Chỉ được tạo nhân viên thuộc cửa hàng bạn quản lý."));
			}
		}
		var (flag, message) = ValidateEducationLevel(dto.EducationLevel);
		if (!flag)
		{
			return BadRequest(ApiResponse.Fail(message));
		}
		User user = await FindUserByUsernameAsync(username);
		if (user != null)
		{
			if (user.Employee != null || (!IsAdmin && !IsManager))
			{
				return BadRequest(ApiResponse.Fail(BuildDuplicateUserMessage("Username", username, user)));
			}
			await RemoveOrphanUserAsync(user);
		}
		User user2 = await FindUserByEmailAsync(email);
		if (user2 != null)
		{
			if (user2.Employee != null || (!IsAdmin && !IsManager))
			{
				return BadRequest(ApiResponse.Fail(BuildDuplicateUserMessage("Email", email, user2)));
			}
			await RemoveOrphanUserAsync(user2);
		}
		IActionResult result3;
		await using (IDbContextTransaction tx = await _db.Database.BeginTransactionAsync())
		{
			try
			{
				User user3 = new User
				{
					Username = username,
					Email = email,
					PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
					Role = dto.Role
				};
				_db.Users.Add(user3);
				await _db.SaveChangesAsync();
				string employeeCode = await GenerateNextEmployeeCodeAsync();
				DateOnly result;
				Employee employee = new Employee
				{
					UserId = user3.Id,
					EmployeeCode = employeeCode,
					FullName = dto.FullName.Trim(),
					Phone = dto.Phone,
					Address = dto.Address,
					EducationLevel = dto.EducationLevel,
					NationalId = dto.NationalId,
					Gender = dto.Gender,
					BankAccountNo = dto.BankAccountNo,
					BankName = dto.BankName,
					BankAccountName = dto.BankAccountName,
					StartDate = (DateOnly.TryParse(dto.StartDate, out result) ? result : DateOnly.FromDateTime(DateTime.Today))
				};
				if (dto.DateOfBirth != null && DateOnly.TryParse(dto.DateOfBirth, out var result2))
				{
					employee.DateOfBirth = result2;
				}
				employee.PrimaryStoreId = primaryStoreId;
				_db.Employees.Add(employee);
				await _db.SaveChangesAsync();
				_db.EmployeeStores.Add(new EmployeeStore
				{
					EmployeeId = employee.Id,
					StoreId = primaryStoreId.Value
				});
				decimal? salaryPerHour = dto.BaseSalaryPerHour;
				string salaryType = "Hourly";
				if (dto.SalaryGradeId.HasValue)
				{
					SalaryGrade salaryGrade = await _db.SalaryGrades.FindAsync(dto.SalaryGradeId.Value);
					if (salaryGrade != null && salaryGrade.IsActive)
					{
						salaryPerHour = salaryGrade.Value;
						salaryType = salaryGrade.Type;
					}
				}
				if (salaryPerHour.HasValue)
				{
					_db.SalaryCoefficients.Add(new SalaryCoefficient
					{
						EmployeeId = employee.Id,
						BaseSalaryPerHour = salaryPerHour.Value,
						SalaryType = salaryType,
						Coefficient = (dto.Coefficient ?? 1.0m),
						EffectiveFrom = DateOnly.FromDateTime(new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1)),
						CreatedBy = CurrentUserId
					});
				}
				await _db.SaveChangesAsync();
				if (dto.Role == "Manager")
				{
					Store store = await _db.Stores.FindAsync(primaryStoreId.Value);
					if (store != null)
					{
						foreach (Store item in await _db.Stores.Where((Store s) => s.ManagerEmployeeId == (int?)employee.Id && s.Id != store.Id).ToListAsync())
						{
							item.ManagerEmployeeId = null;
						}
						store.ManagerEmployeeId = employee.Id;
						await _db.SaveChangesAsync();
					}
				}
				await tx.CommitAsync();
				result3 = Ok(ApiResponse<object>.Ok(new
				{
					id = employee.Id,
					code = employee.EmployeeCode
				}, "Tạo nhân viên thành công."));
			}
			catch (DbUpdateException ex)
			{
				await tx.RollbackAsync();
				result3 = BadRequest(ApiResponse.Fail(MapDbError(ex)));
			}
			catch (Exception ex2)
			{
				await tx.RollbackAsync();
				result3 = StatusCode(500, ApiResponse.Fail("Lỗi tạo nhân viên: " + ex2.Message));
			}
		}
		return result3;
	}

	[HttpPut("{id:int}")]
	[Authorize(Roles = "Admin")]
	public async Task<IActionResult> Update(int id, [FromBody] UpdateEmployeeDto dto)
	{
		Employee employee = await _db.Employees.Include((Employee e) => e.EmployeeStores).FirstOrDefaultAsync((Employee e) => e.Id == id);
		if (employee == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy nhân viên."));
		}
		var (flag, message) = ValidateEducationLevel(dto.EducationLevel);
		if (!flag)
		{
			return BadRequest(ApiResponse.Fail(message));
		}
		employee.FullName = dto.FullName.Trim();
		employee.Phone = dto.Phone;
		employee.Address = dto.Address;
		employee.EducationLevel = dto.EducationLevel;
		employee.EmergencyContact = dto.EmergencyContact;
		employee.NationalId = dto.NationalId;
		employee.Gender = dto.Gender;
		employee.BankAccountNo = dto.BankAccountNo;
		employee.BankName = dto.BankName;
		employee.BankAccountName = dto.BankAccountName;
		employee.UpdatedAt = DateTime.UtcNow;
		if (dto.DateOfBirth != null && DateOnly.TryParse(dto.DateOfBirth, out var result))
		{
			employee.DateOfBirth = result;
		}
		string role = employee.User?.Role ?? "Employee";
		string error;
		int? primaryStoreId = ResolvePrimaryStoreId(dto.PrimaryStoreId, dto.StoreIds, role, out error);
		if (error != null)
		{
			return BadRequest(ApiResponse.Fail(error));
		}
		employee.PrimaryStoreId = primaryStoreId;
		_db.EmployeeStores.RemoveRange(employee.EmployeeStores);
		_db.EmployeeStores.Add(new EmployeeStore
		{
			EmployeeId = id,
			StoreId = primaryStoreId.Value
		});
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok("Cập nhật thành công."));
	}

	[HttpPatch("{id:int}/toggle-active")]
	[Authorize(Roles = "Admin")]
	public async Task<IActionResult> ToggleActive(int id)
	{
		Employee emp = await _db.Employees.Include((Employee e) => e.User).FirstOrDefaultAsync((Employee e) => e.Id == id);
		if (emp == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy nhân viên."));
		}
		emp.IsActive = !emp.IsActive;
		emp.User.IsActive = emp.IsActive;
		emp.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok(emp.IsActive ? "Đã kích hoạt." : "Đã vô hiệu hóa."));
	}

	[HttpPatch("me/bank")]
	[Authorize(Roles = "Employee,Manager,Admin")]
	public async Task<IActionResult> UpdateMyBank([FromBody] UpdateEmployeeBankDto dto)
	{
		int? num = await GetCurrentEmployeeIdAsync();
		if (!num.HasValue)
		{
			return NotFound(ApiResponse.Fail("Tài khoản chưa liên kết nhân viên."));
		}
		return await UpdateBankInternal(num.Value, dto);
	}

	[HttpPatch("{id:int}/bank")]
	[Authorize(Roles = "Admin,Manager,Employee")]
	public async Task<IActionResult> UpdateBank(int id, [FromBody] UpdateEmployeeBankDto dto)
	{
		if (Role == "Employee")
		{
			int? num = await GetCurrentEmployeeIdAsync();
			if (!num.HasValue)
			{
				return NotFound(ApiResponse.Fail("Tài khoản chưa liên kết nhân viên."));
			}
			if (num.Value != id)
			{
				return StatusCode(403, ApiResponse.Fail("Không có quyền sửa thông tin ngân hàng của nhân viên khác."));
			}
			return await UpdateBankInternal(id, dto);
		}
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		if (!(await userStoreScope.CanAccessEmployeeAsync(id)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền sửa nhân viên này."));
		}
		return await UpdateBankInternal(id, dto);
	}

	[HttpGet("me/salary-history")]
	public async Task<IActionResult> GetMySalaryHistory()
	{
		int? num = await GetCurrentEmployeeIdAsync();
		if (!num.HasValue)
		{
			return NotFound(ApiResponse.Fail("Tài khoản chưa liên kết nhân viên."));
		}
		return await GetSalaryHistoryInternal(num.Value, includeActor: false);
	}

	[HttpGet("{id:int}/salary-history")]
	public async Task<IActionResult> GetSalaryHistory(int id)
	{
		if (!CanManageSalary)
		{
			if (await GetCurrentEmployeeIdAsync() != id)
			{
				return Forbid();
			}
			return await GetSalaryHistoryInternal(id, includeActor: false);
		}
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		if (!(await userStoreScope.CanAccessEmployeeAsync(id)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền xem nhân viên này."));
		}
		return await GetSalaryHistoryInternal(id, includeActor: true);
	}

	[HttpPost("{id:int}/salary-coefficients")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> AddSalaryCoefficient(int id, [FromBody] CreateSalaryCoefficientDto dto)
	{
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		if (!(await userStoreScope.CanAccessEmployeeAsync(id)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền chỉnh lương nhân viên này."));
		}
		if (!IsAdmin && dto.SalaryGradeId.HasValue)
		{
			SalaryGrade grade = await _db.SalaryGrades.FindAsync(dto.SalaryGradeId.Value);
			if (grade != null && (grade.MinTenureMonths > 0 || grade.MinWorkedHours > 0m))
			{
				Employee employee = await _db.Employees.FindAsync(id);
				if (employee != null)
				{
					List<string> errors = new List<string>();
					if (grade.MinTenureMonths > 0)
					{
						int num = (int)((DateTime.Today - employee.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays / 30.44);
						if (num < grade.MinTenureMonths)
						{
							errors.Add($"Thâm niên chưa đủ: cần {grade.MinTenureMonths} tháng, hiện tại {num} tháng.");
						}
					}
					if (grade.MinWorkedHours > 0m)
					{
						decimal num2 = (await (from a in _db.Attendances
							where a.EmployeeId == id && a.CheckOut != null
							select new { a.CheckIn, a.CheckOut }).ToListAsync()).Sum(a => (!a.CheckOut.HasValue) ? 0m : ((decimal)(a.CheckOut.Value - a.CheckIn).TotalHours));
						if (num2 < grade.MinWorkedHours)
						{
							errors.Add($"Tổng giờ làm chưa đủ: cần {grade.MinWorkedHours} giờ, hiện tại {num2:0.##} giờ.");
						}
					}
					if (errors.Count > 0)
					{
						return BadRequest(ApiResponse.Fail("Nhân viên chưa đủ điều kiện áp dụng bậc lương " + grade.Code + ". " + string.Join(" ", errors)));
					}
				}
			}
		}
		DateOnly dateOnly = new DateOnly(DateTime.Today.Year, DateTime.Today.Month, 1);
		DateOnly dateOnly2 = dateOnly.AddMonths(1);
		DateOnly dateOnly3 = (IsAdmin ? dateOnly : dateOnly2);
		DateOnly effectiveFrom;
		if (string.IsNullOrWhiteSpace(dto.EffectiveFrom))
		{
			effectiveFrom = dateOnly3;
		}
		else
		{
			if (!DateOnly.TryParse(dto.EffectiveFrom, out effectiveFrom))
			{
				return BadRequest(ApiResponse.Fail("EffectiveFrom không hợp lệ (yyyy-MM-dd)."));
			}
			if (effectiveFrom < dateOnly3)
			{
				string message = (IsAdmin ? $"Ngày áp dụng phải từ {dateOnly:dd/MM/yyyy} (ngày 1 tháng này) trở đi." : $"Quản lý chỉ được đặt lương từ {dateOnly2:dd/MM/yyyy} (tháng sau) trở đi.");
				return BadRequest(ApiResponse.Fail(message));
			}
			if (effectiveFrom.Day != 1)
			{
				return BadRequest(ApiResponse.Fail("Ngày áp dụng phải là ngày 1 của tháng."));
			}
		}
		if (dto.BaseSalaryPerHour <= 0m)
		{
			return BadRequest(ApiResponse.Fail("Lương cơ bản phải lớn hơn 0."));
		}
		decimal coefficient = ((dto.Coefficient > 0m) ? dto.Coefficient : 1m);
		string salaryType = (string.IsNullOrWhiteSpace(dto.SalaryType) ? "Hourly" : dto.SalaryType);
		SalaryCoefficient salaryCoefficient = await _db.SalaryCoefficients.FirstOrDefaultAsync((SalaryCoefficient sc) => sc.EmployeeId == id && sc.EffectiveFrom == effectiveFrom);
		if (salaryCoefficient != null)
		{
			salaryCoefficient.BaseSalaryPerHour = dto.BaseSalaryPerHour;
			salaryCoefficient.SalaryType = salaryType;
			salaryCoefficient.Coefficient = coefficient;
			salaryCoefficient.Note = dto.Note;
			salaryCoefficient.CreatedBy = CurrentUserId;
			await _db.SaveChangesAsync();
			return Ok(ApiResponse.Ok("Cập nhật hệ số lương thành công."));
		}
		_db.SalaryCoefficients.Add(new SalaryCoefficient
		{
			EmployeeId = id,
			BaseSalaryPerHour = dto.BaseSalaryPerHour,
			SalaryType = salaryType,
			Coefficient = coefficient,
			EffectiveFrom = effectiveFrom,
			Note = dto.Note,
			CreatedBy = CurrentUserId
		});
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok("Thêm hệ số lương thành công."));
	}

	[HttpGet("{id:int}/payroll-summary")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> GetPayrollSummary(int id)
	{
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		if (!(await userStoreScope.CanAccessEmployeeAsync(id)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền xem nhân viên này."));
		}
		List<EmployeePayrollSummaryDto> data = (await (from d in _db.PayrollDetails.Include((PayrollDetail d) => d.Payroll).ThenInclude((Payroll p) => p.Store)
			where d.EmployeeId == id
			orderby d.Payroll.Year descending, d.Payroll.Month descending
			select d).ToListAsync()).Select((PayrollDetail d) => new EmployeePayrollSummaryDto
		{
			PayrollId = d.PayrollId,
			Month = d.Payroll.Month,
			Year = d.Payroll.Year,
			StoreName = (d.Payroll.Store?.Name ?? ""),
			WorkedDays = d.WorkedDays,
			WorkedHours = d.WorkedHours,
			OvertimeHours = d.OvertimeHours,
			GrossSalary = d.GrossSalary,
			Bonus = d.Bonus,
			DeliveryAllowance = d.DeliveryAllowance,
			InsuranceDeduction = d.InsuranceDeduction,
			Deduction = d.Deduction,
			NetSalary = d.NetSalary,
			Note = d.Note,
			Status = d.Payroll.Status
		}).ToList();
		return Ok(ApiResponse<List<EmployeePayrollSummaryDto>>.Ok(data));
	}

	[HttpGet("me/payroll-summary")]
	public async Task<IActionResult> GetMyPayrollSummary()
	{
		int? empId = await GetCurrentEmployeeIdAsync();
		if (!empId.HasValue)
		{
			return NotFound(ApiResponse.Fail("Tài khoản chưa liên kết nhân viên."));
		}
		List<EmployeePayrollSummaryDto> data = (from d in await (from d in _db.PayrollDetails.Include((PayrollDetail d) => d.Payroll).ThenInclude((Payroll p) => p.Store)
				where d.EmployeeId == ((int?)empId).Value
				orderby d.Payroll.Year descending, d.Payroll.Month descending
				select d).ToListAsync()
			where d.Payroll.Status == "Approved" || d.Payroll.Status == "Paid"
			select new EmployeePayrollSummaryDto
			{
				PayrollId = d.PayrollId,
				Month = d.Payroll.Month,
				Year = d.Payroll.Year,
				StoreName = (d.Payroll.Store?.Name ?? ""),
				WorkedDays = d.WorkedDays,
				WorkedHours = d.WorkedHours,
				OvertimeHours = d.OvertimeHours,
				GrossSalary = d.GrossSalary,
				Bonus = d.Bonus,
				DeliveryAllowance = d.DeliveryAllowance,
				InsuranceDeduction = d.InsuranceDeduction,
				Deduction = d.Deduction,
				NetSalary = d.NetSalary,
				Note = d.Note,
				Status = d.Payroll.Status
			}).ToList();
		return Ok(ApiResponse<List<EmployeePayrollSummaryDto>>.Ok(data));
	}

	private async Task<int?> GetCurrentEmployeeIdAsync()
	{
		return await _db.Employees.Where((Employee e) => e.UserId == CurrentUserId).Select((Expression<Func<Employee, int?>>)((Employee e) => e.Id)).FirstOrDefaultAsync();
	}

	private async Task<IActionResult> UpdateBankInternal(int empId, UpdateEmployeeBankDto dto)
	{
		Employee employee = await _db.Employees.FindAsync(empId);
		if (employee == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy nhân viên."));
		}
		employee.BankAccountNo = (string.IsNullOrWhiteSpace(dto.BankAccountNo) ? null : dto.BankAccountNo.Trim());
		employee.BankName = (string.IsNullOrWhiteSpace(dto.BankName) ? null : dto.BankName.Trim());
		employee.BankAccountName = (string.IsNullOrWhiteSpace(dto.BankAccountName) ? null : dto.BankAccountName.Trim());
		employee.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync();
		return Ok(ApiResponse<EmployeeDto>.Ok(MapDto(await _db.Employees.Include((Employee e) => e.User).Include((Employee e) => e.EmployeeStores).ThenInclude((EmployeeStore es) => es.Store)
			.Include((Employee e) => e.SalaryCoefficients)
			.FirstAsync((Employee e) => e.Id == empId)), "Đã lưu thông tin ngân hàng."));
	}

	private async Task<IActionResult> GetSalaryHistoryInternal(int employeeId, bool includeActor)
	{
		if (!(await _db.Employees.AnyAsync((Employee e) => e.Id == employeeId)))
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy nhân viên."));
		}
		List<SalaryCoefficientDto> data = (await (from sc in _db.SalaryCoefficients.Include((SalaryCoefficient sc) => sc.CreatedByUser).ThenInclude((User u) => u.Employee)
			where sc.EmployeeId == employeeId
			orderby sc.EffectiveFrom descending, sc.CreatedAt descending
			select sc).ToListAsync()).Select((SalaryCoefficient sc) => MapSalaryDto(sc, includeActor)).ToList();
		return Ok(ApiResponse<List<SalaryCoefficientDto>>.Ok(data));
	}

	private static SalaryCoefficientDto MapSalaryDto(SalaryCoefficient sc, bool includeActor)
	{
		SalaryCoefficientDto salaryCoefficientDto = new SalaryCoefficientDto
		{
			Id = sc.Id,
			EmployeeId = sc.EmployeeId,
			BaseSalaryPerHour = sc.BaseSalaryPerHour,
			SalaryType = sc.SalaryType,
			Coefficient = sc.Coefficient,
			EffectiveFrom = sc.EffectiveFrom.ToString("yyyy-MM-dd"),
			Note = sc.Note,
			CreatedAt = sc.CreatedAt.ToString("yyyy-MM-dd HH:mm")
		};
		if (includeActor)
		{
			salaryCoefficientDto.CreatedByName = sc.CreatedByUser.Employee?.FullName ?? sc.CreatedByUser.Username;
			salaryCoefficientDto.CreatedByRole = sc.CreatedByUser.Role;
		}
		return salaryCoefficientDto;
	}

	private static (bool isValid, string? error) ValidateEducationLevel(string? value)
	{
		if (value == null)
		{
			return (isValid: true, error: null);
		}
		if (EducationLevelValues.Allowed.Contains(value))
		{
			return (isValid: true, error: null);
		}
		return (isValid: false, error: $"Trình độ học vấn '{value}' không hợp lệ. Giá trị cho phép: {string.Join(", ", EducationLevelValues.Allowed)}.");
	}

	private static EmployeeDto MapDto(Employee e)
	{
		DateOnly today = DateOnly.FromDateTime(DateTime.Today);
		SalaryCoefficient salaryCoefficient = (from sc in e.SalaryCoefficients
			where sc.EffectiveFrom <= today
			orderby sc.EffectiveFrom descending, sc.CreatedAt descending
			select sc).FirstOrDefault();
		return new EmployeeDto
		{
			Id = e.Id,
			UserId = e.UserId,
			EmployeeCode = e.EmployeeCode,
			FullName = e.FullName,
			DateOfBirth = e.DateOfBirth?.ToString("yyyy-MM-dd"),
			Gender = e.Gender,
			NationalId = e.NationalId,
			Phone = e.Phone,
			Address = e.Address,
			EducationLevel = e.EducationLevel,
			EmergencyContact = e.EmergencyContact,
			BankAccountNo = e.BankAccountNo,
			BankName = e.BankName,
			BankAccountName = e.BankAccountName,
			StartDate = e.StartDate.ToString("yyyy-MM-dd"),
			IsActive = e.IsActive,
			Role = (e.User?.Role ?? ""),
			Username = (e.User?.Username ?? ""),
			Email = (e.User?.Email ?? ""),
			PrimaryStoreId = (e.PrimaryStoreId ?? e.EmployeeStores.Select((EmployeeStore es) => es.StoreId).FirstOrDefault()),
			PrimaryStoreName = (e.PrimaryStore?.Name ?? e.EmployeeStores.FirstOrDefault((EmployeeStore es) => es.StoreId == e.PrimaryStoreId)?.Store?.Name ?? e.EmployeeStores.FirstOrDefault()?.Store?.Name),
			StoreIds = (e.PrimaryStoreId.HasValue ? new List<int> { e.PrimaryStoreId.Value } : e.EmployeeStores.Select((EmployeeStore es) => es.StoreId).Take(1).ToList()),
			StoreNames = ((e.PrimaryStoreId.HasValue && e.PrimaryStore != null) ? new List<string> { e.PrimaryStore.Name } : e.EmployeeStores.Select((EmployeeStore es) => es.Store?.Name ?? "").Take(1).ToList()),
			CurrentSalary = ((salaryCoefficient == null) ? null : new SalaryCoefficientDto
			{
				Id = salaryCoefficient.Id,
				EmployeeId = salaryCoefficient.EmployeeId,
				BaseSalaryPerHour = salaryCoefficient.BaseSalaryPerHour,
				Coefficient = salaryCoefficient.Coefficient,
				EffectiveFrom = salaryCoefficient.EffectiveFrom.ToString("yyyy-MM-dd"),
				Note = salaryCoefficient.Note,
				CreatedAt = salaryCoefficient.CreatedAt.ToString("yyyy-MM-dd HH:mm")
			})
		};
	}

	private async Task<string> GenerateNextEmployeeCodeAsync()
	{
		List<string> list = await (from e in _db.Employees.AsNoTracking()
			select e.EmployeeCode).ToListAsync();
		int num = 0;
		foreach (string item in list)
		{
			if (!string.IsNullOrWhiteSpace(item))
			{
				string text = item.Trim();
				if (text.Length > 2 && text.StartsWith("NV", StringComparison.OrdinalIgnoreCase) && int.TryParse(text.Substring(2), out var result))
				{
					num = Math.Max(num, result);
				}
			}
		}
		for (int num2 = 0; num2 < 500; num2++)
		{
			string candidate = $"NV{num + 1 + num2:D3}";
			if (!list.Any((string x) => string.Equals(x, candidate, StringComparison.OrdinalIgnoreCase)))
			{
				return candidate;
			}
		}
		return $"NV{DateTime.UtcNow:yyMMddHHmmss}";
	}

	private static string MapDbError(DbUpdateException ex)
	{
		string text = ex.InnerException?.Message ?? ex.Message;
		if (text.Contains("PrimaryStoreId", StringComparison.OrdinalIgnoreCase) || text.Contains("Invalid column name", StringComparison.OrdinalIgnoreCase))
		{
			return "DB thiếu cột PrimaryStoreId — chạy script BE/Database/31_Employee_PrimaryStore.sql trên WorkforceManagement.";
		}
		if (text.Contains("UQ_Employees_Code", StringComparison.OrdinalIgnoreCase) || text.Contains("EmployeeCode", StringComparison.OrdinalIgnoreCase))
		{
			return "Mã nhân viên (EmployeeCode) bị trùng. Thử lại hoặc báo Admin kiểm tra DB.";
		}
		if (text.Contains("UQ_Users_Username", StringComparison.OrdinalIgnoreCase))
		{
			return "Username đã tồn tại trong bảng Users.";
		}
		if (text.Contains("UQ_Users_Email", StringComparison.OrdinalIgnoreCase))
		{
			return "Email đã tồn tại trong bảng Users.";
		}
		if (text.Length <= 300)
		{
			return text;
		}
		return text.Substring(0, 300);
	}

	private async Task<User?> FindUserByUsernameAsync(string username)
	{
		string u = username.Trim().ToLower();
		return await _db.Users.Include((User x) => x.Employee).FirstOrDefaultAsync((User x) => x.Username.ToLower() == u);
	}

	private async Task<User?> FindUserByEmailAsync(string email)
	{
		string em = email.Trim().ToLower();
		return await _db.Users.Include((User x) => x.Employee).FirstOrDefaultAsync((User x) => x.Email.ToLower() == em);
	}

	private async Task RemoveOrphanUserAsync(User orphan)
	{
		List<RefreshToken> list = await _db.RefreshTokens.Where((RefreshToken rt) => rt.UserId == orphan.Id).ToListAsync();
		if (list.Count > 0)
		{
			_db.RefreshTokens.RemoveRange(list);
		}
		_db.Users.Remove(orphan);
		await _db.SaveChangesAsync();
	}

	private static object MapConflictUser(User existing)
	{
		Employee employee = existing.Employee;
		return new
		{
			userId = existing.Id,
			username = existing.Username,
			email = existing.Email,
			role = existing.Role,
			isActive = existing.IsActive,
			isOrphan = (employee == null),
			employeeId = employee?.Id,
			employeeCode = employee?.EmployeeCode,
			fullName = employee?.FullName,
			hint = ((employee == null) ? "User mồ côi (có trong bảng Users, không có hồ sơ NV) — không hiện trong danh sách Nhân viên." : "NV thuộc cửa hàng khác có thể không hiện khi bạn lọc theo CH.")
		};
	}

	private static string BuildDuplicateUserMessage(string field, string value, User existing)
	{
		Employee employee = existing.Employee;
		string value2 = ((existing.IsActive && (employee == null || employee.IsActive)) ? "đang hoạt động" : "đã nghỉ / vô hiệu");
		string value3 = ((employee == null) ? $"user mồ côi #{existing.Id} ({existing.Role}) — KHÔNG có trong danh sách NV" : (employee.EmployeeCode + " — " + employee.FullName));
		return $"{field} «{value}» đã được dùng bởi {value3} ({value2}, UserId={existing.Id}). Chọn {field.ToLower()} khác (gợi ý: SĐT, tên.ch). " + ((employee == null) ? "Đây là tài khoản tạo dở — Admin deploy BE mới sẽ tự xóa user mồ côi khi tạo lại, hoặc chạy script 34_Cleanup_Orphan_Users.sql." : "Tìm username trong ô tìm kiếm (bỏ lọc cửa hàng) hoặc hỏi Admin.");
	}

	private static int? ResolvePrimaryStoreId(int? primaryStoreId, List<int> storeIds, string role, out string? error)
	{
		error = null;
		List<int> list = storeIds?.Where((int x) => x > 0).Distinct().ToList() ?? new List<int>();
		int? result = ((primaryStoreId > 0) ? primaryStoreId : ((list.Count > 0) ? new int?(list[0]) : ((int?)null)));
		if (!result.HasValue || result.Value <= 0)
		{
			error = "Phải chọn cửa hàng chính.";
			return null;
		}
		if (list.Count > 1 || (list.Count == 1 && list[0] != result.Value))
		{
			error = "Chỉ được chọn một cửa hàng chính. Quản lý có thể đăng ký ca tại cửa hàng khác khi đăng ký ca làm.";
			return null;
		}
		if (string.Equals(role, "Employee", StringComparison.OrdinalIgnoreCase) && list.Count > 1)
		{
			error = "Nhân viên chỉ được gán một cửa hàng chính.";
			return null;
		}
		return result;
	}
}
