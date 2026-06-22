using System;

namespace WorkforceManagement.Api.Data;

public class InsuranceRate
{
	public int Id { get; set; }

	public string Code { get; set; } = "";

	public string? Label { get; set; }

	public decimal Amount { get; set; }

	public bool IsActive { get; set; } = true;

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public DateTime? UpdatedAt { get; set; }
}
