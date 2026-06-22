namespace WorkforceManagement.Api.Models.Shift;

public class AssignShiftSlotDto
{
	public int EmployeeId { get; set; }

	public int StoreId { get; set; }

	public string WorkDate { get; set; } = "";

	public string StartTime { get; set; } = "";

	public string EndTime { get; set; } = "";
}
