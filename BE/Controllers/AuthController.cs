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
using WorkforceManagement.Api.Models.Auth;
using WorkforceManagement.Api.Services;

namespace WorkforceManagement.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
	private readonly AuthService _auth;

	public AuthController(AuthService auth)
	{
		_auth = auth;
	}

	[HttpPost("login")]
	public async Task<IActionResult> Login([FromBody] LoginRequest req)
	{
		LoginResponse loginResponse = await _auth.LoginAsync(req);
		if (loginResponse == null)
		{
			return Unauthorized(ApiResponse.Fail("Tên đăng nhập hoặc mật khẩu không đúng."));
		}
		return Ok(ApiResponse<LoginResponse>.Ok(loginResponse, "Đăng nhập thành công."));
	}

	[HttpPost("refresh")]
	public async Task<IActionResult> Refresh([FromBody] RefreshRequest req)
	{
		LoginResponse loginResponse = await _auth.RefreshAsync(req.RefreshToken);
		if (loginResponse == null)
		{
			return Unauthorized(ApiResponse.Fail("Refresh token không hợp lệ hoặc đã hết hạn."));
		}
		return Ok(ApiResponse<LoginResponse>.Ok(loginResponse));
	}

	[HttpPost("logout")]
	[Authorize]
	public async Task<IActionResult> Logout([FromBody] RefreshRequest req)
	{
		await _auth.RevokeAsync(req.RefreshToken);
		return Ok(ApiResponse.Ok("Đăng xuất thành công."));
	}

	[HttpGet("me")]
	[Authorize]
	public async Task<IActionResult> Me([FromServices] AppDbContext db)
	{
		int userId = int.Parse(base.User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ?? "0");
		User user = await db.Users.Include((User u) => u.Employee).FirstOrDefaultAsync((User u) => u.Id == userId);
		if (user == null)
		{
			return Unauthorized(ApiResponse.Fail("Phiên đăng nhập không hợp lệ."));
		}
		List<int> storeIds = new List<int>();
		int? primaryStoreId = null;
		if (user.Employee != null)
		{
			primaryStoreId = user.Employee.PrimaryStoreId;
			if (!primaryStoreId.HasValue)
			{
				primaryStoreId = await ((IQueryable<EmployeeStore>)(from es in db.EmployeeStores
					where es.EmployeeId == user.Employee.Id
					orderby es.StoreId
					select es)).Select((Expression<Func<EmployeeStore, int?>>)((EmployeeStore es) => es.StoreId)).FirstOrDefaultAsync();
			}
			if (primaryStoreId.HasValue)
			{
				storeIds.Add(primaryStoreId.Value);
			}
		}
		return Ok(ApiResponse<object>.Ok(new
		{
			id = user.Id,
			username = user.Username,
			email = user.Email,
			role = user.Role,
			fullName = (user.Employee?.FullName ?? user.Username),
			employeeId = user.Employee?.Id,
			employeeCode = user.Employee?.EmployeeCode,
			bankAccountNo = user.Employee?.BankAccountNo,
			bankName = user.Employee?.BankName,
			bankAccountName = user.Employee?.BankAccountName,
			primaryStoreId = primaryStoreId,
			storeIds = storeIds,
			educationLevel = user.Employee?.EducationLevel
		}));
	}
}
