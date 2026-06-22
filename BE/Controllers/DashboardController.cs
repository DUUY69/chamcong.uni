using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Models;
using WorkforceManagement.Api.Models.Dashboard;
using WorkforceManagement.Api.Services;

namespace WorkforceManagement.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = "Admin,Manager")]
public class DashboardController : ControllerBase
{
	private readonly AppDbContext _db;

	public DashboardController(AppDbContext db)
	{
		_db = db;
	}

	[HttpGet("operations")]
	public async Task<IActionResult> GetOperations([FromQuery] string? workDate, [FromQuery] int? storeId)
	{
		DateOnly result;
		DateOnly wd = (DateOnly.TryParse(workDate, out result) ? result : DateOnly.FromDateTime(DateTime.Today));
		UserStoreScope scope = new UserStoreScope(_db, base.User);
		List<int> managedStoreIds = await scope.GetManagedStoreIdsAsync();
		if (storeId.HasValue && !(await scope.IsStoreFilterAllowedAsync(storeId)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền xem cửa hàng này."));
		}
		return Ok(ApiResponse<OperationsDashboardDto>.Ok(await OperationsDashboardService.BuildAsync(_db, wd, managedStoreIds, storeId)));
	}
}
