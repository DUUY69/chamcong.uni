using System;

namespace WorkforceManagement.Api.Data;

public class SalaryGrade
{
	public int Id { get; set; }

	public string Code { get; set; } = "";

	public string? Label { get; set; }

	public decimal Value { get; set; }

	public string Type { get; set; } = "Hourly";

	public bool IsActive { get; set; } = true;

	public int MinTenureMonths { get; set; }

	public decimal MinWorkedHours { get; set; }

	public string? RaiseConditionNote { get; set; }

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public DateTime? UpdatedAt { get; set; }
}
