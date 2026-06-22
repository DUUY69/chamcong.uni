namespace WorkforceManagement.Api.Models.Employee;

public class EmployeePayrollSummaryDto
{
	public int PayrollId { get; set; }

	public int Month { get; set; }

	public int Year { get; set; }

	public string StoreName { get; set; } = "";

	public decimal WorkedDays { get; set; }

	public decimal WorkedHours { get; set; }

	public decimal OvertimeHours { get; set; }

	public decimal GrossSalary { get; set; }

	public decimal Bonus { get; set; }

	public decimal DeliveryAllowance { get; set; }

	public decimal InsuranceDeduction { get; set; }

	public decimal Deduction { get; set; }

	public decimal NetSalary { get; set; }

	public string? Note { get; set; }

	public string Status { get; set; } = "";
}
