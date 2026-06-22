namespace WorkforceManagement.Api.Models.Shift;

public class UpdateShiftRegistrationDto
{
	public int StoreId { get; set; }

	public string StartTime { get; set; } = "";

	public string EndTime { get; set; } = "";
}
