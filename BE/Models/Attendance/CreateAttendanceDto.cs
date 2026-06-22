namespace WorkforceManagement.Api.Models.Attendance;

public class CreateAttendanceDto
{
	public int EmployeeId { get; set; }

	public int StoreId { get; set; }

	public string WorkDate { get; set; } = "";

	public string CheckIn { get; set; } = "";

	public string CheckOut { get; set; } = "";

	public string? Note { get; set; }
}
