namespace WorkforceManagement.Api.Models.Dashboard;

public class StoreAttendanceScoreDto
{
	public int Score { get; set; }

	public decimal OnTimeRate { get; set; }

	public decimal StaffingRate { get; set; }

	public decimal OvertimeRate { get; set; }

	public decimal AbsenceRate { get; set; }
}
