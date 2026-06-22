namespace WorkforceManagement.Api.Models.Payroll;

public class PaymentDto
{
	public int Id { get; set; }

	public int PayrollId { get; set; }

	public int EmployeeId { get; set; }

	public string EmployeeName { get; set; } = "";

	public decimal Amount { get; set; }

	public string PaymentDate { get; set; } = "";

	public string? PaymentMethod { get; set; }

	public string? Note { get; set; }

	public string RecordedByName { get; set; } = "";

	public string CreatedAt { get; set; } = "";
}
