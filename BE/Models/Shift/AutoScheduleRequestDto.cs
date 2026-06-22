namespace WorkforceManagement.Api.Models.Shift;

public class AutoScheduleRequestDto
{
	public int StoreId { get; set; }

	public string DateFrom { get; set; } = "";

	public string DateTo { get; set; } = "";
}
