namespace WorkforceManagement.Api.Models.Employee;

public class EmployeeInsuranceDto
{
	public int EmployeeId { get; set; }

	public string Mode { get; set; } = "None";

	public decimal MonthlyPremium { get; set; }

	public int? InsuranceRateId { get; set; }

	public string? InsuranceRateCode { get; set; }

	public string? InsuranceRateLabel { get; set; }

	public string? BhxhNumber { get; set; }

	public string? Note { get; set; }

	public string UpdatedAt { get; set; } = "";
}
