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
using WorkforceManagement.Api.Models.Store;
using WorkforceManagement.Api.Services;

namespace WorkforceManagement.Api.Controllers;

[ApiController]
[Route("api/stores")]
[Authorize]
public class StoresController : ControllerBase
{
	private readonly AppDbContext _db;

	private string Role => base.User.FindFirstValue("http://schemas.microsoft.com/ws/2008/06/identity/claims/role") ?? "";

	private bool IsAdmin => Role == "Admin";

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

	public StoresController(AppDbContext db)
	{
		_db = db;
	}

	[HttpGet("options")]
	public async Task<IActionResult> GetOptions()
	{
		return Ok(ApiResponse<List<StoreDto>>.Ok(await (from s in _db.Stores
			where s.IsActive
			orderby s.Name
			select new StoreDto
			{
				Id = s.Id,
				Name = s.Name,
				Address = s.Address,
				Phone = s.Phone,
				IsActive = s.IsActive,
				EmployeeCount = s.EmployeeStores.Count,
				StandardWorkHoursPerDay = s.StandardWorkHoursPerDay,
				OvertimeRateMultiplier = s.OvertimeRateMultiplier,
				RequiredStaffPerDay = s.RequiredStaffPerDay
			}).ToListAsync()));
	}

	[HttpGet("assigned")]
	public async Task<IActionResult> GetAssigned()
	{
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		List<int> storeIds = await userStoreScope.GetManagedStoreIdsAsync();
		IQueryable<Store> source = _db.Stores.Where((Store s) => s.IsActive);
		if (storeIds != null)
		{
			if (storeIds.Count == 0)
			{
				return Ok(ApiResponse<List<StoreDto>>.Ok(new List<StoreDto>()));
			}
			source = source.Where((Store s) => storeIds.Contains(s.Id));
		}
		return Ok(ApiResponse<List<StoreDto>>.Ok(await (from s in source
			orderby s.Name
			select new StoreDto
			{
				Id = s.Id,
				Name = s.Name,
				Address = s.Address,
				Phone = s.Phone,
				IsActive = s.IsActive,
				EmployeeCount = s.EmployeeStores.Count,
				StandardWorkHoursPerDay = s.StandardWorkHoursPerDay,
				OvertimeRateMultiplier = s.OvertimeRateMultiplier,
				RequiredStaffPerDay = s.RequiredStaffPerDay
			}).ToListAsync()));
	}

	private static StoreDto MapStore(Store s, int employeeCount)
	{
		return new StoreDto
		{
			Id = s.Id,
			Name = s.Name,
			Address = s.Address,
			Phone = s.Phone,
			IsActive = s.IsActive,
			EmployeeCount = employeeCount,
			StandardWorkHoursPerDay = s.StandardWorkHoursPerDay,
			OvertimeRateMultiplier = s.OvertimeRateMultiplier,
			RequiredStaffPerDay = ((s.RequiredStaffPerDay > 0) ? s.RequiredStaffPerDay : 5),
			ManagerEmployeeId = s.ManagerEmployeeId,
			ManagerName = s.Manager?.FullName,
			ManagerCode = s.Manager?.EmployeeCode
		};
	}

	private async Task<string?> AssignManagerAsync(Store store, int? managerEmployeeId)
	{
		if (!managerEmployeeId.HasValue || managerEmployeeId.Value <= 0)
		{
			store.ManagerEmployeeId = null;
			return null;
		}
		Employee emp = await _db.Employees.Include((Employee e) => e.User).FirstOrDefaultAsync((Employee e) => e.Id == ((int?)managerEmployeeId).Value);
		if (emp == null)
		{
			return "Không tìm thấy nhân viên quản lý.";
		}
		if (emp.User?.Role != "Manager")
		{
			return "Chỉ có thể gán tài khoản vai trò Quản lý.";
		}
		foreach (Store item in await _db.Stores.Where((Store s) => s.ManagerEmployeeId == (int?)emp.Id && s.Id != store.Id).ToListAsync())
		{
			item.ManagerEmployeeId = null;
		}
		if (store.ManagerEmployeeId.HasValue && store.ManagerEmployeeId != emp.Id)
		{
			EmployeeStore employeeStore = await _db.EmployeeStores.FirstOrDefaultAsync((EmployeeStore es) => es.StoreId == store.Id && es.EmployeeId == store.ManagerEmployeeId.Value);
			if (employeeStore != null)
			{
				_db.EmployeeStores.Remove(employeeStore);
			}
		}
		store.ManagerEmployeeId = emp.Id;
		List<EmployeeStore> entities = await _db.EmployeeStores.Where((EmployeeStore es) => es.EmployeeId == emp.Id && es.StoreId != store.Id).ToListAsync();
		_db.EmployeeStores.RemoveRange(entities);
		if (!(await _db.EmployeeStores.AnyAsync((EmployeeStore es) => es.StoreId == store.Id && es.EmployeeId == emp.Id)))
		{
			_db.EmployeeStores.Add(new EmployeeStore
			{
				StoreId = store.Id,
				EmployeeId = emp.Id
			});
		}
		return null;
	}

	[HttpGet]
	public async Task<IActionResult> GetAll()
	{
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		List<int> storeIds = await userStoreScope.GetManagedStoreIdsAsync();
		if (storeIds != null && storeIds.Count == 0)
		{
			return Ok(ApiResponse<List<StoreDto>>.Ok(new List<StoreDto>()));
		}
		IQueryable<Store> source = _db.Stores.Include((Store store) => store.Manager).AsQueryable();
		if (storeIds != null)
		{
			source = source.Where((Store store) => storeIds.Contains(store.Id));
		}
		List<Store> list = await source.OrderBy((Store store) => store.Name).ToListAsync();
		List<StoreDto> result = new List<StoreDto>();
		foreach (Store s in list)
		{
			int employeeCount = await _db.EmployeeStores.CountAsync((EmployeeStore es) => es.StoreId == s.Id);
			result.Add(MapStore(s, employeeCount));
		}
		return Ok(ApiResponse<List<StoreDto>>.Ok(result));
	}

	[HttpGet("{id:int}")]
	public async Task<IActionResult> GetById(int id)
	{
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		if (!(await userStoreScope.CanAccessStoreAsync(id)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền xem cửa hàng này."));
		}
		Store s = await _db.Stores.Include((Store x) => x.Manager).FirstOrDefaultAsync((Store x) => x.Id == id);
		if (s == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy cửa hàng."));
		}
		return Ok(ApiResponse<StoreDto>.Ok(MapStore(s, await _db.EmployeeStores.CountAsync((EmployeeStore es) => es.StoreId == id))));
	}

	[HttpPost]
	[Authorize(Roles = "Admin")]
	public async Task<IActionResult> Create([FromBody] CreateStoreDto dto)
	{
		if (string.IsNullOrWhiteSpace(dto.Name))
		{
			return BadRequest(ApiResponse.Fail("Tên cửa hàng không được để trống."));
		}
		Store store = new Store
		{
			Name = dto.Name.Trim(),
			Address = dto.Address,
			Phone = dto.Phone,
			StandardWorkHoursPerDay = ((dto.StandardWorkHoursPerDay > (decimal?)0m) ? dto.StandardWorkHoursPerDay.Value : 8m),
			OvertimeRateMultiplier = ((dto.OvertimeRateMultiplier > (decimal?)0m) ? dto.OvertimeRateMultiplier.Value : 1.5m)
		};
		_db.Stores.Add(store);
		await _db.SaveChangesAsync();
		if (dto.ManagerEmployeeId.HasValue)
		{
			string text = await AssignManagerAsync(store, dto.ManagerEmployeeId);
			if (text != null)
			{
				return BadRequest(ApiResponse.Fail(text));
			}
			store.UpdatedAt = DateTime.UtcNow;
			await _db.SaveChangesAsync();
		}
		await _db.Entry(store).Reference((Store s) => s.Manager).LoadAsync();
		return Ok(ApiResponse<StoreDto>.Ok(MapStore(store, 0), "Tạo cửa hàng thành công."));
	}

	[HttpPut("{id:int}")]
	[Authorize(Roles = "Admin")]
	public async Task<IActionResult> Update(int id, [FromBody] UpdateStoreDto dto)
	{
		Store store = await _db.Stores.FindAsync(id);
		if (store == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy cửa hàng."));
		}
		store.Name = dto.Name.Trim();
		store.Address = dto.Address;
		store.Phone = dto.Phone;
		if (dto.StandardWorkHoursPerDay > (decimal?)0m)
		{
			store.StandardWorkHoursPerDay = dto.StandardWorkHoursPerDay.Value;
		}
		if (dto.OvertimeRateMultiplier > (decimal?)0m)
		{
			store.OvertimeRateMultiplier = dto.OvertimeRateMultiplier.Value;
		}
		string text = await AssignManagerAsync(store, dto.ManagerEmployeeId);
		if (text != null)
		{
			return BadRequest(ApiResponse.Fail(text));
		}
		store.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok("Cập nhật thành công."));
	}

	[HttpPatch("{id:int}/toggle-active")]
	[Authorize(Roles = "Admin")]
	public async Task<IActionResult> ToggleActive(int id)
	{
		Store store = await _db.Stores.FindAsync(id);
		if (store == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy cửa hàng."));
		}
		store.IsActive = !store.IsActive;
		store.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok(store.IsActive ? "Đã kích hoạt." : "Đã vô hiệu hóa."));
	}

	[HttpGet("{id:int}/employees")]
	public async Task<IActionResult> GetEmployees(int id)
	{
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		if (!(await userStoreScope.CanAccessStoreAsync(id)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền xem cửa hàng này."));
		}
		return Ok(ApiResponse<object>.Ok(await (from es in _db.EmployeeStores.Where((EmployeeStore es) => es.StoreId == id).Include((EmployeeStore es) => es.Employee).ThenInclude((Employee e) => e.User)
			select new
			{
				es.Employee.Id,
				es.Employee.EmployeeCode,
				es.Employee.FullName,
				es.Employee.User.Role,
				es.Employee.IsActive
			}).ToListAsync()));
	}

	[HttpPost("{id:int}/employees")]
	[Authorize(Roles = "Admin")]
	public async Task<IActionResult> AssignEmployee(int id, [FromBody] AssignEmployeeDto dto)
	{
		if (await _db.EmployeeStores.AnyAsync((EmployeeStore es) => es.StoreId == id && es.EmployeeId == dto.EmployeeId))
		{
			return BadRequest(ApiResponse.Fail("Nhân viên đã được gán vào cửa hàng này."));
		}
		_db.EmployeeStores.Add(new EmployeeStore
		{
			StoreId = id,
			EmployeeId = dto.EmployeeId
		});
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok("Gán nhân viên thành công."));
	}

	[HttpDelete("{id:int}/employees/{employeeId:int}")]
	[Authorize(Roles = "Admin")]
	public async Task<IActionResult> RemoveEmployee(int id, int employeeId)
	{
		EmployeeStore es = await _db.EmployeeStores.FirstOrDefaultAsync((EmployeeStore x) => x.StoreId == id && x.EmployeeId == employeeId);
		if (es == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy."));
		}
		Store store = await _db.Stores.FindAsync(id);
		if (store != null && store.ManagerEmployeeId == employeeId)
		{
			store.ManagerEmployeeId = null;
		}
		_db.EmployeeStores.Remove(es);
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok("Đã gỡ nhân viên."));
	}
}
