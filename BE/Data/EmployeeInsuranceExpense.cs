using System;

namespace WorkforceManagement.Api.Data;

public class EmployeeInsuranceExpense
{
	public int Id { get; set; }

	public int EmployeeId { get; set; }

	public int Year { get; set; }

	public int Month { get; set; }

	public decimal Amount { get; set; }

	public string? Note { get; set; }

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public int? CreatedBy { get; set; }

	public Employee Employee { get; set; }

	public User? CreatedByUser { get; set; }
}
