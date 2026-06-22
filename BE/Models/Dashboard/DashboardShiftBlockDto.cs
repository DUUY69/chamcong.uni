namespace WorkforceManagement.Api.Models.Dashboard;

public class DashboardShiftBlockDto
{
	public string Start { get; set; } = "";

	public string End { get; set; } = "";

	public int ScheduledCount { get; set; }

	public int CheckedInCount { get; set; }
}
