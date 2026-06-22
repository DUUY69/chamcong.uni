namespace WorkforceManagement.Api.Models.Attendance;

public class StoreAttendanceAlertDto
{
	public int StoreId { get; set; }

	public string StoreName { get; set; } = "";

	public int FlaggedCount { get; set; }

	public int TotalEditCount { get; set; }

	public int TotalRecords { get; set; }

	public string AlertLevel { get; set; } = "ok";

	public string AlertLabel { get; set; } = "Ổn";
}
