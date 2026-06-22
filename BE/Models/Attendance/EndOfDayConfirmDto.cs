namespace WorkforceManagement.Api.Models.Attendance;

public class EndOfDayConfirmDto
{
	public string WorkDate { get; set; } = "";

	public int? StoreId { get; set; }

	public string? Note { get; set; }
}
