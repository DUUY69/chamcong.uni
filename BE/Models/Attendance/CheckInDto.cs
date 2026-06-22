namespace WorkforceManagement.Api.Models.Attendance;

public class CheckInDto
{
	public int? ShiftRegistrationId { get; set; }

	public int? StoreId { get; set; }

	public string? WorkDate { get; set; }
}
