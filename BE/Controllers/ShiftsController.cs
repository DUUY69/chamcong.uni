using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Models;
using WorkforceManagement.Api.Models.Shift;
using WorkforceManagement.Api.Services;

namespace WorkforceManagement.Api.Controllers;

[ApiController]
[Route("api/shifts")]
[Authorize]
public class ShiftsController : ControllerBase
{
	private readonly AppDbContext _db;

	public ShiftsController(AppDbContext db)
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
			return Ok(ApiResponse<List<ShiftDto>>.Ok(new List<ShiftDto>()));
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
		IQueryable<Shift> source = _db.Shifts.Include((Shift s) => s.Store).AsQueryable();
		if (managedStoreIds != null)
		{
			source = source.Where((Shift s) => managedStoreIds.Contains(s.StoreId));
		}
		if (storeId.HasValue)
		{
			source = source.Where((Shift s) => s.StoreId == ((int?)storeId).Value);
		}
		if (isActive.HasValue)
		{
			source = source.Where((Shift s) => s.IsActive == ((bool?)isActive).Value);
		}
		return Ok(ApiResponse<List<ShiftDto>>.Ok((await (from s in source
			orderby s.StoreId, s.StartTime
			select s).ToListAsync()).Select(MapDto).ToList()));
	}

	[HttpPost]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> Create([FromBody] CreateShiftDto dto)
	{
		if (!TimeOnly.TryParse(dto.StartTime, out var result) || !TimeOnly.TryParse(dto.EndTime, out var result2))
		{
			return BadRequest(ApiResponse.Fail("Giờ không hợp lệ (HH:mm)."));
		}
		if (result2 <= result)
		{
			return BadRequest(ApiResponse.Fail("Giờ kết thúc phải sau giờ bắt đầu."));
		}
		Shift shift = new Shift
		{
			StoreId = dto.StoreId,
			Name = dto.Name.Trim(),
			StartTime = result,
			EndTime = result2
		};
		_db.Shifts.Add(shift);
		await _db.SaveChangesAsync();
		return Ok(ApiResponse<ShiftDto>.Ok(MapDto(shift), "Tạo ca thành công."));
	}

	[HttpPut("{id:int}")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> Update(int id, [FromBody] UpdateShiftDto dto)
	{
		Shift shift = await _db.Shifts.FindAsync(id);
		if (shift == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy ca."));
		}
		if (!TimeOnly.TryParse(dto.StartTime, out var result) || !TimeOnly.TryParse(dto.EndTime, out var result2))
		{
			return BadRequest(ApiResponse.Fail("Giờ không hợp lệ."));
		}
		if (result2 <= result)
		{
			return BadRequest(ApiResponse.Fail("Giờ kết thúc phải sau giờ bắt đầu."));
		}
		shift.Name = dto.Name.Trim();
		shift.StartTime = result;
		shift.EndTime = result2;
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok("Cập nhật thành công."));
	}

	[HttpPatch("{id:int}/toggle-active")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> ToggleActive(int id)
	{
		Shift shift = await _db.Shifts.FindAsync(id);
		if (shift == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy ca."));
		}
		shift.IsActive = !shift.IsActive;
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok(shift.IsActive ? "Đã kích hoạt." : "Đã vô hiệu hóa."));
	}

	private static ShiftDto MapDto(Shift s)
	{
		return new ShiftDto
		{
			Id = s.Id,
			StoreId = s.StoreId,
			StoreName = (s.Store?.Name ?? ""),
			Name = s.Name,
			StartTime = s.StartTime.ToString("HH:mm"),
			EndTime = s.EndTime.ToString("HH:mm"),
			WorkHours = (s.EndTime - s.StartTime).TotalHours,
			IsActive = s.IsActive
		};
	}
}
