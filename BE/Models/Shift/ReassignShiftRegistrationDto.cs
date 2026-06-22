namespace WorkforceManagement.Api.Models.Shift;

public class ReassignShiftRegistrationDto
{
	public int StoreId { get; set; }

	public string StartTime { get; set; } = "";

	public string EndTime { get; set; } = "";

	public string? WorkDate { get; set; }

	public string? SliceStart { get; set; }

	public string? SliceEnd { get; set; }
}
