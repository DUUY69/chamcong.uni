namespace WorkforceManagement.Api.Models.Attendance;

public class ConfirmShiftAttendanceDto
{
	public int ShiftRegistrationId { get; set; }

	public bool Worked { get; set; }
}
