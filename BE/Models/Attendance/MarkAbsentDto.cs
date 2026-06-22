namespace WorkforceManagement.Api.Models.Attendance;

public class MarkAbsentDto
{
	public int EmployeeId { get; set; }

	public int StoreId { get; set; }

	public string WorkDate { get; set; } = "";

	public string? Note { get; set; }
}
