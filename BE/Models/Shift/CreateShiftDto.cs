namespace WorkforceManagement.Api.Models.Shift;

public class CreateShiftDto
{
	public int StoreId { get; set; }

	public string Name { get; set; } = "";

	public string StartTime { get; set; } = "";

	public string EndTime { get; set; } = "";
}
