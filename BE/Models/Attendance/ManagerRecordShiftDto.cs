namespace WorkforceManagement.Api.Models.Attendance;

public class ManagerRecordShiftDto
{
	public int ShiftRegistrationId { get; set; }

	public string CheckIn { get; set; } = "";

	public string CheckOut { get; set; } = "";

	public string? Note { get; set; }
}
