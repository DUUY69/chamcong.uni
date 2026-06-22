namespace WorkforceManagement.Api.Models.Attendance;

public class AttendanceSummaryDto
{
	public int EmployeeId { get; set; }

	public string EmployeeName { get; set; } = "";

	public string EmployeeCode { get; set; } = "";

	public int WorkedDays { get; set; }

	public decimal WorkedHours { get; set; }

	public decimal OvertimeHours { get; set; }
}
