namespace WorkforceManagement.Api.Models.Shift;

public class CreateShiftRegistrationDto
{
	public int StoreId { get; set; }

	public string WorkDate { get; set; } = "";

	public string StartTime { get; set; } = "";

	public string EndTime { get; set; } = "";
}
