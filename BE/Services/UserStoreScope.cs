using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;

namespace WorkforceManagement.Api.Services;

public class UserStoreScope
{
	private readonly AppDbContext _db;

	private readonly ClaimsPrincipal _user;

	private List<int>? _managedStoreIds;

	private bool _loaded;

	public string Role => _user.FindFirstValue("http://schemas.microsoft.com/ws/2008/06/identity/claims/role") ?? "";

	public bool IsAdmin => Role == "Admin";

	public bool IsManager => Role == "Manager";

	public int? EmployeeId
	{
		get
		{
			string s = _user.FindFirstValue("employeeId");
			if (!int.TryParse(s, out var result) || result <= 0)
			{
				return null;
			}
			return result;
		}
	}

	public UserStoreScope(AppDbContext db, ClaimsPrincipal user)
	{
		_db = db;
		_user = user;
	}

	public async Task<List<int>?> GetManagedStoreIdsAsync()
	{
		if (_loaded)
		{
			return _managedStoreIds;
		}
		_loaded = true;
		if (IsAdmin)
		{
			_managedStoreIds = null;
			return null;
		}
		if (!EmployeeId.HasValue)
		{
			_managedStoreIds = new List<int>();
			return _managedStoreIds;
		}
		if (IsManager)
		{
			_managedStoreIds = await (from s in _db.Stores
				where s.ManagerEmployeeId == (int?)EmployeeId.Value && s.IsActive
				select s.Id).ToListAsync();
			return _managedStoreIds;
		}
		_managedStoreIds = await (from es in _db.EmployeeStores
			where es.EmployeeId == EmployeeId.Value
			select es.StoreId).Distinct().ToListAsync();
		return _managedStoreIds;
	}

	public async Task<bool> CanAccessStoreAsync(int storeId)
	{
		return (await GetManagedStoreIdsAsync())?.Contains(storeId) ?? true;
	}

	public async Task<bool> CanAccessEmployeeAsync(int employeeId)
	{
		if (EmployeeId.HasValue && EmployeeId.Value == employeeId)
		{
			return true;
		}
		List<int> ids = await GetManagedStoreIdsAsync();
		if (ids == null)
		{
			return true;
		}
		if (ids.Count == 0)
		{
			return false;
		}
		return await _db.EmployeeStores.AnyAsync((EmployeeStore es) => es.EmployeeId == employeeId && ids.Contains(es.StoreId));
	}

	public async Task<bool> IsStoreFilterAllowedAsync(int? storeId)
	{
		if (!storeId.HasValue)
		{
			return true;
		}
		return await CanAccessStoreAsync(storeId.Value);
	}
}
