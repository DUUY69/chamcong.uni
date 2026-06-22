namespace WorkforceManagement.Api.Models.Payroll;

public class PayrollDetailDto
{
	public int Id { get; set; }

	public int EmployeeId { get; set; }

	public string EmployeeName { get; set; } = "";

	public string EmployeeCode { get; set; } = "";

	public string? BankAccountNo { get; set; }

	public string? BankName { get; set; }

	public string? BankAccountName { get; set; }

	public decimal WorkedDays { get; set; }

	public decimal WorkedHours { get; set; }

	public decimal OvertimeHours { get; set; }

	public decimal BaseSalaryPerHour { get; set; }

	public decimal Coefficient { get; set; }

	public decimal GrossSalary { get; set; }

	public decimal Bonus { get; set; }

	public decimal DeliveryAllowance { get; set; }

	public decimal InsuranceDeduction { get; set; }

	public decimal Deduction { get; set; }

	public decimal NetSalary { get; set; }

	public string? Note { get; set; }
}
