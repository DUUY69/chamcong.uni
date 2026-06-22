namespace WorkforceManagement.Api.Services;

public class AutoScheduleApprovedItem
{
	public int RegistrationId { get; set; }

	public string WorkDate { get; set; } = "";

	public string SlotLabel { get; set; } = "";

	public string StartTime { get; set; } = "";

	public string EndTime { get; set; } = "";
}
