namespace WorkforceManagement.Api.Models.Shift;

public class DayLaborSummaryDto
{
	public string Date { get; set; } = "";

	public int StoreId { get; set; }

	public decimal EmployeeHours { get; set; }

	public decimal ManagerHours { get; set; }

	public decimal EmployeeEstPay { get; set; }

	public decimal ManagerEstPay { get; set; }
}
