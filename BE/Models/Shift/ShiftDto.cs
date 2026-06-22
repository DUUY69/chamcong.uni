namespace WorkforceManagement.Api.Models.Shift;

public class ShiftDto
{
	public int Id { get; set; }

	public int StoreId { get; set; }

	public string StoreName { get; set; } = "";

	public string Name { get; set; } = "";

	public string StartTime { get; set; } = "";

	public string EndTime { get; set; } = "";

	public double WorkHours { get; set; }

	public bool IsActive { get; set; }
}
