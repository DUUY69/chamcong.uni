namespace WorkforceManagement.Api.Models.Attendance;

public class UpdateAttendanceDto
{
	public string CheckIn { get; set; } = "";

	public string CheckOut { get; set; } = "";

	public string? Note { get; set; }
}
