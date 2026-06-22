using System;

namespace WorkforceManagement.Api.Data;

public class SalaryRaiseRule
{
	public int Id { get; set; }

	public int MinTenureMonths { get; set; }

	public decimal MinWorkedHours { get; set; }

	public string? Description { get; set; }

	public bool IsActive { get; set; } = true;

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public DateTime? UpdatedAt { get; set; }
}
