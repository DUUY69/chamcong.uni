using System;

namespace WorkforceManagement.Api.Data;

public class SalaryCoefficient
{
	public int Id { get; set; }

	public int EmployeeId { get; set; }

	public decimal BaseSalaryPerHour { get; set; }

	public string SalaryType { get; set; } = "Hourly";

	public decimal Coefficient { get; set; } = 1.0m;

	public DateOnly EffectiveFrom { get; set; }

	public string? Note { get; set; }

	public int CreatedBy { get; set; }

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public Employee Employee { get; set; }

	public User CreatedByUser { get; set; }
}
