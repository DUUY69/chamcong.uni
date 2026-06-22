namespace WorkforceManagement.Api.Models.Dashboard;

public class DashboardLaborDto
{
	public decimal EstimatedPay { get; set; }

	public decimal ConfirmedPay { get; set; }

	public decimal OvertimeHours { get; set; }

	public decimal StaffingFulfillmentPct { get; set; }

	public int RequiredStaff { get; set; }

	public int ApprovedStaff { get; set; }
}
