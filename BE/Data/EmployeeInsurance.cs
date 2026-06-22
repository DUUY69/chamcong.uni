using System;

namespace WorkforceManagement.Api.Data;

public class EmployeeInsurance
{
	public int EmployeeId { get; set; }

	public string Mode { get; set; } = "None";

	public decimal MonthlyPremium { get; set; }

	public int? InsuranceRateId { get; set; }

	public string? BhxhNumber { get; set; }

	public string? Note { get; set; }

	public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

	public int? UpdatedBy { get; set; }

	public Employee Employee { get; set; }

	public InsuranceRate? InsuranceRate { get; set; }

	public User? UpdatedByUser { get; set; }
}
