using System;

namespace WorkforceManagement.Api.Data;

public class DeliveryAllowance
{
	public int Id { get; set; }

	public int EmployeeId { get; set; }

	public int StoreId { get; set; }

	public int Year { get; set; }

	public int Month { get; set; }

	public decimal Amount { get; set; }

	public string? Note { get; set; }

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

	public int? UpdatedBy { get; set; }

	public Employee Employee { get; set; }

	public Store Store { get; set; }

	public User? UpdatedByUser { get; set; }
}
