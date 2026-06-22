namespace WorkforceManagement.Api.Models.Attendance;

public class AttendanceDto
{
	public int Id { get; set; }

	public int EmployeeId { get; set; }

	public string EmployeeName { get; set; } = "";

	public string EmployeeCode { get; set; } = "";

	public int StoreId { get; set; }

	public string StoreName { get; set; } = "";

	public string WorkDate { get; set; } = "";

	public string CheckIn { get; set; } = "";

	public string? CheckOut { get; set; }

	public bool IsOpen { get; set; }

	public decimal WorkedHours { get; set; }

	public decimal OvertimeHours { get; set; }

	public decimal StandardHours { get; set; }

	public string Status { get; set; } = "";

	public string StatusLabel { get; set; } = "";

	public string ReviewStatus { get; set; } = "";

	public string ReviewStatusLabel { get; set; } = "";

	public int? ShiftRegistrationId { get; set; }

	public string? ScheduledStart { get; set; }

	public string? ScheduledEnd { get; set; }

	public string? ActualCheckIn { get; set; }

	public string? ActualCheckOut { get; set; }

	public string? SuggestedCheckIn { get; set; }

	public string? SuggestedCheckOut { get; set; }

	public int EditCount { get; set; }

	public bool FlaggedForReview { get; set; }

	public string? Note { get; set; }

	public string CreatedAt { get; set; } = "";
}
