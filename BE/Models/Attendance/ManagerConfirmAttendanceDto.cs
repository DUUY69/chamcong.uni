namespace WorkforceManagement.Api.Models.Attendance;

public class ManagerConfirmAttendanceDto
{
	public string? CheckIn { get; set; }

	public string? CheckOut { get; set; }

	public string? Note { get; set; }

	public bool Absent { get; set; }
}
