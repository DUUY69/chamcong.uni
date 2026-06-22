using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using BCrypt.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Models.Auth;

namespace WorkforceManagement.Api.Services;

public class AuthService
{
	private readonly AppDbContext _db;

	private readonly IConfiguration _config;

	public AuthService(AppDbContext db, IConfiguration config)
	{
		_db = db;
		_config = config;
	}

	public async Task<LoginResponse?> LoginAsync(LoginRequest req)
	{
		User user = await _db.Users.Include((User u) => u.Employee).FirstOrDefaultAsync((User u) => (u.Username == req.Username || u.Email == req.Username) && u.IsActive);
		if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
		{
			return null;
		}
		string accessToken = GenerateJwt(user);
		string refreshToken = await CreateRefreshTokenAsync(user.Id);
		return new LoginResponse
		{
			AccessToken = accessToken,
			RefreshToken = refreshToken,
			ExpiresIn = int.Parse(_config["Jwt:ExpiryMinutes"] ?? "480") * 60,
			User = new UserInfo
			{
				Id = user.Id,
				Username = user.Username,
				Email = user.Email,
				Role = user.Role,
				FullName = (user.Employee?.FullName ?? user.Username),
				EmployeeId = user.Employee?.Id
			}
		};
	}

	public async Task<LoginResponse?> RefreshAsync(string refreshToken)
	{
		RefreshToken token = await _db.RefreshTokens.Include((RefreshToken t) => t.User).ThenInclude((User u) => u.Employee).FirstOrDefaultAsync((RefreshToken t) => t.Token == refreshToken && !t.IsRevoked && t.ExpiresAt > DateTime.UtcNow);
		if (token == null)
		{
			return null;
		}
		token.IsRevoked = true;
		string newRefresh = await CreateRefreshTokenAsync(token.UserId);
		string accessToken = GenerateJwt(token.User);
		await _db.SaveChangesAsync();
		return new LoginResponse
		{
			AccessToken = accessToken,
			RefreshToken = newRefresh,
			ExpiresIn = int.Parse(_config["Jwt:ExpiryMinutes"] ?? "480") * 60,
			User = new UserInfo
			{
				Id = token.User.Id,
				Username = token.User.Username,
				Email = token.User.Email,
				Role = token.User.Role,
				FullName = (token.User.Employee?.FullName ?? token.User.Username),
				EmployeeId = token.User.Employee?.Id
			}
		};
	}

	public async Task RevokeAsync(string refreshToken)
	{
		RefreshToken refreshToken2 = await _db.RefreshTokens.FirstOrDefaultAsync((RefreshToken t) => t.Token == refreshToken);
		if (refreshToken2 != null)
		{
			refreshToken2.IsRevoked = true;
			await _db.SaveChangesAsync();
		}
	}

	private string GenerateJwt(User user)
	{
		SymmetricSecurityKey key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]));
		SigningCredentials signingCredentials = new SigningCredentials(key, "HS256");
		DateTime value = DateTime.UtcNow.AddMinutes(int.Parse(_config["Jwt:ExpiryMinutes"] ?? "480"));
		Claim[] claims = new Claim[6]
		{
			new Claim("sub", user.Id.ToString()),
			new Claim("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier", user.Id.ToString()),
			new Claim("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name", user.Username),
			new Claim("http://schemas.microsoft.com/ws/2008/06/identity/claims/role", user.Role),
			new Claim("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress", user.Email),
			new Claim("employeeId", user.Employee?.Id.ToString() ?? "")
		};
		string? issuer = _config["Jwt:Issuer"];
		string? audience = _config["Jwt:Audience"];
		DateTime? expires = value;
		SigningCredentials signingCredentials2 = signingCredentials;
		JwtSecurityToken token = new JwtSecurityToken(issuer, audience, claims, null, expires, signingCredentials2);
		return new JwtSecurityTokenHandler().WriteToken(token);
	}

	private async Task<string> CreateRefreshTokenAsync(int userId)
	{
		string token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
		_db.RefreshTokens.Add(new RefreshToken
		{
			UserId = userId,
			Token = token,
			ExpiresAt = DateTime.UtcNow.AddDays(7.0)
		});
		await _db.SaveChangesAsync();
		return token;
	}
}
