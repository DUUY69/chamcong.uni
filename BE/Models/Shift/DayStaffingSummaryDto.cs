namespace WorkforceManagement.Api.Models.Shift;

public class DayStaffingSummaryDto
{
	public string Date { get; set; } = "";

	public int StoreId { get; set; }

	public int Required { get; set; }

	public int ApprovedCount { get; set; }

	public int PendingCount { get; set; }

	public int RegisteredCount { get; set; }

	public string Status { get; set; } = "none";
}
