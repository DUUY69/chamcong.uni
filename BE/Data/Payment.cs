using System;

namespace WorkforceManagement.Api.Data;

public class Payment
{
	public int Id { get; set; }

	public int PayrollId { get; set; }

	public int EmployeeId { get; set; }

	public decimal Amount { get; set; }

	public DateOnly PaymentDate { get; set; }

	public string? PaymentMethod { get; set; }

	public string? Note { get; set; }

	public int RecordedBy { get; set; }

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public Payroll Payroll { get; set; }

	public Employee Employee { get; set; }

	public User RecordedByUser { get; set; }
}
