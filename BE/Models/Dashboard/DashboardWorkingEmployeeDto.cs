namespace WorkforceManagement.Api.Models.Dashboard;

public class DashboardWorkingEmployeeDto
{
	public int EmployeeId { get; set; }

	public string EmployeeName { get; set; } = "";

	public string StoreName { get; set; } = "";

	public string Since { get; set; } = "";

	public string ScheduledEnd { get; set; } = "";
}
