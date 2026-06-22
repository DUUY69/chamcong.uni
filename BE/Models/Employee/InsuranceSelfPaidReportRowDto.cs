namespace WorkforceManagement.Api.Models.Employee;

public class InsuranceSelfPaidReportRowDto
{
	public int EmployeeId { get; set; }

	public string EmployeeCode { get; set; } = "";

	public string EmployeeName { get; set; } = "";

	public int Year { get; set; }

	public int Month { get; set; }

	public decimal Amount { get; set; }

	public string? Note { get; set; }
}
