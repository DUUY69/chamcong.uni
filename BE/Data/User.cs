using System;
using System.Collections.Generic;

namespace WorkforceManagement.Api.Data;

public class User
{
	public int Id { get; set; }

	public string Username { get; set; } = "";

	public string Email { get; set; } = "";

	public string PasswordHash { get; set; } = "";

	public string Role { get; set; } = "Employee";

	public bool IsActive { get; set; } = true;

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public DateTime? UpdatedAt { get; set; }

	public Employee? Employee { get; set; }

	public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
