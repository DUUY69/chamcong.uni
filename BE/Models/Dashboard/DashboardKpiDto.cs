namespace WorkforceManagement.Api.Models.Dashboard;

public class DashboardKpiDto
{
	public int TotalScheduled { get; set; }

	public int CheckedIn { get; set; }

	public int Late { get; set; }

	public int OnLeave { get; set; }

	public decimal TodayLaborCost { get; set; }
}
