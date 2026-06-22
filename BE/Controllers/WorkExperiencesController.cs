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
[Route("api/employees/{employeeId:int}/work-experiences")]
[Authorize]
public class WorkExperiencesController : ControllerBase
{
	private readonly AppDbContext _db;

	private string Role => base.User.FindFirstValue("http://schemas.microsoft.com/ws/2008/06/identity/claims/role") ?? "";

	private bool IsAdmin => Role == "Admin";

	public WorkExperiencesController(AppDbContext db)
	{
		_db = db;
	}

	[HttpGet]
	public async Task<IActionResult> GetAll(int employeeId)
	{
		if (!(await _db.Employees.AnyAsync((Employee e) => e.Id == employeeId)))
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy nhân viên."));
		}
		return Ok(ApiResponse<List<WorkExperienceDto>>.Ok((await (from x in _db.EmployeeWorkExperiences
			where x.EmployeeId == employeeId
			orderby x.StartDate descending
			select x).ToListAsync()).Select(MapDto).ToList()));
	}

	[HttpPost]
	[Authorize(Roles = "Admin")]
	public async Task<IActionResult> Create(int employeeId, [FromBody] SaveWorkExperienceDto dto)
	{
		if (!(await _db.Employees.AnyAsync((Employee e) => e.Id == employeeId)))
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy nhân viên."));
		}
		var (flag, message, startDate, endDate) = ValidateDto(dto);
		if (!flag)
		{
			return BadRequest(ApiResponse.Fail(message));
		}
		EmployeeWorkExperience exp = new EmployeeWorkExperience
		{
			EmployeeId = employeeId,
			CompanyName = dto.CompanyName.Trim(),
			Position = dto.Position.Trim(),
			StartDate = startDate,
			EndDate = endDate,
			Description = dto.Description?.Trim()
		};
		_db.EmployeeWorkExperiences.Add(exp);
		await _db.SaveChangesAsync();
		return Ok(ApiResponse<WorkExperienceDto>.Ok(MapDto(exp), "Thêm kinh nghiệm thành công."));
	}

	[HttpPut("{expId:int}")]
	[Authorize(Roles = "Admin")]
	public async Task<IActionResult> Update(int employeeId, int expId, [FromBody] SaveWorkExperienceDto dto)
	{
		EmployeeWorkExperience exp = await _db.EmployeeWorkExperiences.FirstOrDefaultAsync((EmployeeWorkExperience x) => x.Id == expId && x.EmployeeId == employeeId);
		if (exp == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy bản ghi kinh nghiệm."));
		}
		var (flag, message, startDate, endDate) = ValidateDto(dto);
		if (!flag)
		{
			return BadRequest(ApiResponse.Fail(message));
		}
		exp.CompanyName = dto.CompanyName.Trim();
		exp.Position = dto.Position.Trim();
		exp.StartDate = startDate;
		exp.EndDate = endDate;
		exp.Description = dto.Description?.Trim();
		exp.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync();
		return Ok(ApiResponse<WorkExperienceDto>.Ok(MapDto(exp), "Cập nhật thành công."));
	}

	[HttpDelete("{expId:int}")]
	[Authorize(Roles = "Admin")]
	public async Task<IActionResult> Delete(int employeeId, int expId)
	{
		EmployeeWorkExperience employeeWorkExperience = await _db.EmployeeWorkExperiences.FirstOrDefaultAsync((EmployeeWorkExperience x) => x.Id == expId && x.EmployeeId == employeeId);
		if (employeeWorkExperience == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy bản ghi kinh nghiệm."));
		}
		_db.EmployeeWorkExperiences.Remove(employeeWorkExperience);
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok("Đã xóa bản ghi kinh nghiệm."));
	}

	private static (bool valid, string? error, DateOnly startDate, DateOnly? endDate) ValidateDto(SaveWorkExperienceDto dto)
	{
		if (string.IsNullOrWhiteSpace(dto.CompanyName))
		{
			return (valid: false, error: "Tên công ty không được để trống.", startDate: default(DateOnly), endDate: null);
		}
		if (string.IsNullOrWhiteSpace(dto.Position))
		{
			return (valid: false, error: "Chức danh không được để trống.", startDate: default(DateOnly), endDate: null);
		}
		if (!DateOnly.TryParse(dto.StartDate, out var result))
		{
			return (valid: false, error: "Ngày bắt đầu không hợp lệ (định dạng yyyy-MM-dd).", startDate: default(DateOnly), endDate: null);
		}
		DateOnly? item = null;
		if (!string.IsNullOrWhiteSpace(dto.EndDate))
		{
			if (!DateOnly.TryParse(dto.EndDate, out var result2))
			{
				return (valid: false, error: "Ngày kết thúc không hợp lệ (định dạng yyyy-MM-dd).", startDate: default(DateOnly), endDate: null);
			}
			if (result2 < result)
			{
				return (valid: false, error: "Ngày kết thúc phải sau ngày bắt đầu.", startDate: default(DateOnly), endDate: null);
			}
			item = result2;
		}
		return (valid: true, error: null, startDate: result, endDate: item);
	}

	private static WorkExperienceDto MapDto(EmployeeWorkExperience e)
	{
		return new WorkExperienceDto
		{
			Id = e.Id,
			EmployeeId = e.EmployeeId,
			CompanyName = e.CompanyName,
			Position = e.Position,
			StartDate = e.StartDate.ToString("yyyy-MM-dd"),
			EndDate = e.EndDate?.ToString("yyyy-MM-dd"),
			Description = e.Description,
			CreatedAt = e.CreatedAt.ToString("yyyy-MM-dd HH:mm")
		};
	}
}
