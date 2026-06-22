namespace WorkforceManagement.Api.Models.Employee;

public class UpsertEmployeeInsuranceDto
{
	public string Mode { get; set; } = "None";

	public int? InsuranceRateId { get; set; }

	public decimal MonthlyPremium { get; set; }

	public string? BhxhNumber { get; set; }

	public string? Note { get; set; }
}
