namespace WorkforceManagement.Api.Models.Dashboard;

public class DashboardEmployeeRankDto
{
	public int EmployeeId { get; set; }

	public string EmployeeName { get; set; } = "";

	public int Count { get; set; }

	public string Label { get; set; } = "";
}
