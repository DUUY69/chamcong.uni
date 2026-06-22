namespace WorkforceManagement.Api.Models.Dashboard;

public class DashboardAlertItemDto
{
	public string Level { get; set; } = "info";

	public string Message { get; set; } = "";

	public string? StoreName { get; set; }
}
