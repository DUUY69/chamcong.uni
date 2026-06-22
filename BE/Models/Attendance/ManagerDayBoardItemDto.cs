namespace WorkforceManagement.Api.Models.Attendance;

public class ManagerDayBoardItemDto
{
	public int ShiftRegistrationId { get; set; }

	public int EmployeeId { get; set; }

	public string EmployeeName { get; set; } = "";

	public string EmployeeCode { get; set; } = "";

	public int StoreId { get; set; }

	public string StoreName { get; set; } = "";

	public string WorkDate { get; set; } = "";

	public string ScheduledStart { get; set; } = "";

	public string ScheduledEnd { get; set; } = "";

	public string PunchStatus { get; set; } = "None";

	public string PunchStatusLabel { get; set; } = "";

	public int? AttendanceId { get; set; }

	public string? ActualCheckIn { get; set; }

	public string? ActualCheckOut { get; set; }

	public string? SuggestedCheckIn { get; set; }

	public string? SuggestedCheckOut { get; set; }

	public string? ConfirmedCheckIn { get; set; }

	public string? ConfirmedCheckOut { get; set; }

	public decimal? ScheduledHours { get; set; }

	public decimal? ConfirmedHours { get; set; }

	public decimal? SuggestedHours { get; set; }
}
