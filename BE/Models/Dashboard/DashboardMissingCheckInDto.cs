namespace WorkforceManagement.Api.Models.Dashboard;

public class DashboardMissingCheckInDto
{
	public int EmployeeId { get; set; }

	public string EmployeeName { get; set; } = "";

	public string StoreName { get; set; } = "";

	public string ScheduledStart { get; set; } = "";

	public string ScheduledEnd { get; set; } = "";
}
