using System;

namespace WorkforceManagement.Api.Data;

public class ShiftRegistration
{
	public int Id { get; set; }

	public int EmployeeId { get; set; }

	public int? ShiftId { get; set; }

	public TimeOnly StartTime { get; set; }

	public TimeOnly EndTime { get; set; }

	public int StoreId { get; set; }

	public DateOnly WorkDate { get; set; }

	public string Status { get; set; } = "Pending";

	public string? RejectReason { get; set; }

	public int? ReviewedBy { get; set; }

	public DateTime? ReviewedAt { get; set; }

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public Employee Employee { get; set; }

	public Shift? Shift { get; set; }

	public Store Store { get; set; }

	public User? Reviewer { get; set; }
}
