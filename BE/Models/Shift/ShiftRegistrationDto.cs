namespace WorkforceManagement.Api.Models.Shift;

public class ShiftRegistrationDto
{
	public int Id { get; set; }

	public int EmployeeId { get; set; }

	public string EmployeeName { get; set; } = "";

	public int? ShiftId { get; set; }

	public string ShiftName { get; set; } = "";

	public string StartTime { get; set; } = "";

	public string EndTime { get; set; } = "";

	public string ShiftTime { get; set; } = "";

	public int StoreId { get; set; }

	public string StoreName { get; set; } = "";

	public string? StoreAddress { get; set; }

	public string WorkDate { get; set; } = "";

	public string Status { get; set; } = "";

	public string? RejectReason { get; set; }

	public string CreatedAt { get; set; } = "";
}
