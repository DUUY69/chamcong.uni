using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Models;

namespace WorkforceManagement.Api.Controllers;

[ApiController]
[Route("api/announcements")]
[Authorize]
public class AnnouncementsController : ControllerBase
{
	private readonly AppDbContext _db;

	private static readonly HashSet<string> AllowedTypes = new HashSet<string>(StringComparer.Ordinal) { "Promotion", "Training", "NewProduct", "Guideline" };

	private static readonly HashSet<string> AllowedScopes = new HashSet<string>(StringComparer.Ordinal) { "AllStores", "SpecificStores" };

	private int CurrentUserId => int.Parse(base.User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ?? "0");

	private string Role => base.User.FindFirstValue("http://schemas.microsoft.com/ws/2008/06/identity/claims/role") ?? "";

	private bool IsAdmin => Role == "Admin";

	public AnnouncementsController(AppDbContext db)
	{
		_db = db;
	}

	[HttpGet]
	public async Task<IActionResult> GetAll([FromQuery] bool? activeOnly)
	{
		IQueryable<Announcement> q = _db.Announcements.Include((Announcement a) => a.Creator).Include((Announcement a) => a.AnnouncementStores).ThenInclude((AnnouncementStore s) => s.Store)
			.AsQueryable();
		if (activeOnly == true)
		{
			q = q.Where((Announcement a) => a.IsActive);
		}
		if (!IsAdmin)
		{
			List<int> myStoreIds = await (from es in _db.EmployeeStores
				where es.Employee.UserId == CurrentUserId
				select es.StoreId).ToListAsync();
			q = q.Where((Announcement a) => a.Scope == "AllStores" || a.AnnouncementStores.Any((AnnouncementStore s) => myStoreIds.Contains(s.StoreId)));
		}
		return Ok(ApiResponse<List<AnnouncementDto>>.Ok((await q.OrderByDescending((Announcement a) => a.CreatedAt).ToListAsync()).Select(MapDto).ToList()));
	}

	[HttpPost]
	[Authorize(Roles = "Admin")]
	public async Task<IActionResult> Create([FromBody] SaveAnnouncementDto dto)
	{
		var (flag, message) = ValidateDto(dto);
		if (!flag)
		{
			return BadRequest(ApiResponse.Fail(message));
		}
		int? createdBy = await _db.Employees.Where((Employee e) => e.UserId == CurrentUserId).Select((Expression<Func<Employee, int?>>)((Employee e) => e.Id)).FirstOrDefaultAsync();
		Announcement ann = new Announcement
		{
			Title = dto.Title.Trim(),
			Content = dto.Content?.Trim(),
			LinkUrl = dto.LinkUrl?.Trim(),
			AnnouncementType = dto.AnnouncementType,
			Scope = dto.Scope,
			CreatedBy = createdBy,
			IsActive = true
		};
		_db.Announcements.Add(ann);
		await _db.SaveChangesAsync();
		if (dto.Scope == "SpecificStores")
		{
			foreach (int item in dto.StoreIds.Distinct())
			{
				_db.AnnouncementStores.Add(new AnnouncementStore
				{
					AnnouncementId = ann.Id,
					StoreId = item
				});
			}
		}
		await _db.SaveChangesAsync();
		return Ok(ApiResponse<AnnouncementDto>.Ok(MapDto(await LoadOne(ann.Id)), "Tạo thông báo thành công."));
	}

	[HttpPut("{id:int}")]
	[Authorize(Roles = "Admin")]
	public async Task<IActionResult> Update(int id, [FromBody] SaveAnnouncementDto dto)
	{
		Announcement ann = await _db.Announcements.Include((Announcement a) => a.AnnouncementStores).FirstOrDefaultAsync((Announcement a) => a.Id == id);
		if (ann == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy thông báo."));
		}
		var (flag, message) = ValidateDto(dto);
		if (!flag)
		{
			return BadRequest(ApiResponse.Fail(message));
		}
		ann.Title = dto.Title.Trim();
		ann.Content = dto.Content?.Trim();
		ann.LinkUrl = dto.LinkUrl?.Trim();
		ann.AnnouncementType = dto.AnnouncementType;
		ann.Scope = dto.Scope;
		ann.UpdatedAt = DateTime.UtcNow;
		_db.AnnouncementStores.RemoveRange(ann.AnnouncementStores);
		if (dto.Scope == "SpecificStores")
		{
			foreach (int item in dto.StoreIds.Distinct())
			{
				_db.AnnouncementStores.Add(new AnnouncementStore
				{
					AnnouncementId = ann.Id,
					StoreId = item
				});
			}
		}
		await _db.SaveChangesAsync();
		return Ok(ApiResponse<AnnouncementDto>.Ok(MapDto(await LoadOne(ann.Id)), "Cập nhật thành công."));
	}

	[HttpPatch("{id:int}/toggle-active")]
	[Authorize(Roles = "Admin")]
	public async Task<IActionResult> ToggleActive(int id)
	{
		Announcement ann = await _db.Announcements.FindAsync(id);
		if (ann == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy thông báo."));
		}
		ann.IsActive = !ann.IsActive;
		ann.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync();
		return Ok(ApiResponse<AnnouncementDto>.Ok(MapDto(await LoadOne(ann.Id)), ann.IsActive ? "Đã kích hoạt." : "Đã vô hiệu hóa."));
	}

	[HttpDelete("{id:int}")]
	[Authorize(Roles = "Admin")]
	public async Task<IActionResult> Delete(int id)
	{
		Announcement announcement = await _db.Announcements.FindAsync(id);
		if (announcement == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy thông báo."));
		}
		_db.Announcements.Remove(announcement);
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok("Đã xóa thông báo."));
	}

	private async Task<Announcement> LoadOne(int id)
	{
		return await _db.Announcements.Include((Announcement a) => a.Creator).Include((Announcement a) => a.AnnouncementStores).ThenInclude((AnnouncementStore s) => s.Store)
			.FirstOrDefaultAsync((Announcement a) => a.Id == id);
	}

	private static (bool valid, string? error) ValidateDto(SaveAnnouncementDto dto)
	{
		if (string.IsNullOrWhiteSpace(dto.Title))
		{
			return (valid: false, error: "Tiêu đề không được để trống.");
		}
		if (!AllowedTypes.Contains(dto.AnnouncementType))
		{
			return (valid: false, error: "announcementType không hợp lệ. Cho phép: " + string.Join(", ", AllowedTypes));
		}
		if (!AllowedScopes.Contains(dto.Scope))
		{
			return (valid: false, error: "scope không hợp lệ. Cho phép: " + string.Join(", ", AllowedScopes));
		}
		if (dto.Scope == "SpecificStores" && (dto.StoreIds == null || dto.StoreIds.Count == 0))
		{
			return (valid: false, error: "Phải chọn ít nhất một cửa hàng khi phạm vi là SpecificStores.");
		}
		return (valid: true, error: null);
	}

	private static AnnouncementDto MapDto(Announcement a)
	{
		return new AnnouncementDto
		{
			Id = a.Id,
			Title = a.Title,
			Content = a.Content,
			LinkUrl = a.LinkUrl,
			AnnouncementType = a.AnnouncementType,
			Scope = a.Scope,
			StoreIds = a.AnnouncementStores.Select((AnnouncementStore s) => s.StoreId).ToList(),
			StoreNames = ((a.Scope == "AllStores") ? new List<string> { "Tất cả cửa hàng" } : a.AnnouncementStores.Select((AnnouncementStore s) => s.Store?.Name ?? "").ToList()),
			CreatedBy = a.CreatedBy,
			CreatedByName = (a.Creator?.FullName ?? ""),
			IsActive = a.IsActive,
			CreatedAt = a.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
			UpdatedAt = a.UpdatedAt?.ToString("yyyy-MM-dd HH:mm")
		};
	}
}
