using System.Collections.Generic;
using System.Threading.Tasks;
using BCrypt.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Models;

namespace WorkforceManagement.Api.Controllers;

[ApiController]
[Route("api/setup")]
public class SetupController : ControllerBase
{
	private readonly AppDbContext _db;

	public SetupController(AppDbContext db)
	{
		_db = db;
	}

	[HttpGet("status")]
	public async Task<IActionResult> Status()
	{
		var anon = new
		{
			users = await _db.Users.CountAsync(),
			stores = await _db.Stores.CountAsync(),
			employees = await _db.Employees.CountAsync(),
			attendances = await _db.Attendances.CountAsync(),
			payrolls = await _db.Payrolls.CountAsync()
		};
		bool flag = anon.users > 0 && anon.stores > 0;
		string message = (flag ? "DB đã có dữ liệu. Quản lý qua app hoặc script SQL." : "DB trống. Chạy Database/postgres/01_schema.sql rồi 02_seed.sql (PostgreSQL).");
		return Ok(ApiResponse<object>.Ok(new
		{
			counts = anon,
			ready = flag
		}, message));
	}

	[HttpPost("reset-demo-passwords")]
	public async Task<IActionResult> ResetDemoPasswords()
	{
		List<string> updated = new List<string>();
		foreach (User item in await _db.Users.ToListAsync())
		{
			string role = item.Role;
			string text = ((role == "Admin") ? "Admin@123" : ((!(role == "Manager")) ? "Employee@123" : "Manager@123"));
			string inputKey = text;
			item.PasswordHash = BCrypt.Net.BCrypt.HashPassword(inputKey);
			updated.Add(item.Username);
		}
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok("Đã cập nhật BCrypt cho: " + string.Join(", ", updated)));
	}

	[HttpPost("reset-all-passwords")]
	public async Task<IActionResult> ResetAllPasswords([FromBody] ResetAllPasswordsDto dto)
	{
		if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 4)
		{
			return BadRequest(ApiResponse.Fail("Mật khẩu phải có ít nhất 4 ký tự."));
		}
		string hash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
		List<User> users = await _db.Users.ToListAsync();
		foreach (User item in users)
		{
			item.PasswordHash = hash;
		}
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok($"Đã đổi mật khẩu {users.Count} user thành '{dto.Password}'."));
	}

	[HttpPost("admin")]
	public async Task<IActionResult> CreateAdmin([FromBody] CreateAdminDto dto)
	{
		if (await _db.Users.AnyAsync((User u) => u.Role == "Admin"))
		{
			return BadRequest(ApiResponse.Fail("Admin đã tồn tại."));
		}
		User entity = new User
		{
			Username = dto.Username,
			Email = dto.Email,
			PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
			Role = "Admin"
		};
		_db.Users.Add(entity);
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok("Tạo admin '" + dto.Username + "' thành công."));
	}
}
