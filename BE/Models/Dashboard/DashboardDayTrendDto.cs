namespace WorkforceManagement.Api.Models.Dashboard;

public class DashboardDayTrendDto
{
	public string Date { get; set; } = "";

	public int Present { get; set; }

	public int Absent { get; set; }

	public int Late { get; set; }
}
