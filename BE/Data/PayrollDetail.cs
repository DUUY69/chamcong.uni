namespace WorkforceManagement.Api.Data;

public class PayrollDetail
{
	public int Id { get; set; }

	public int PayrollId { get; set; }

	public int EmployeeId { get; set; }

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

	public decimal NetSalary => GrossSalary + Bonus + DeliveryAllowance - Deduction;

	public string? Note { get; set; }

	public Payroll Payroll { get; set; }

	public Employee Employee { get; set; }
}
