using System;

namespace WorkforceManagement.Api.Data;

public class RefreshToken
{
	public int Id { get; set; }

	public int UserId { get; set; }

	public string Token { get; set; } = "";

	public DateTime ExpiresAt { get; set; }

	public bool IsRevoked { get; set; }

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public User User { get; set; }
}
