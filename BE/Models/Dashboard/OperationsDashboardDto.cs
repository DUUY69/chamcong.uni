using System.Collections.Generic;

namespace WorkforceManagement.Api.Models.Dashboard;

public class OperationsDashboardDto
{
	public string WorkDate { get; set; } = "";

	public int? StoreId { get; set; }

	public string? StoreName { get; set; }

	public DashboardKpiDto Kpi { get; set; } = new DashboardKpiDto();

	public List<DashboardAlertItemDto> Alerts { get; set; } = new List<DashboardAlertItemDto>();

	public List<DashboardMissingCheckInDto> MissingCheckIn { get; set; } = new List<DashboardMissingCheckInDto>();

	public List<DashboardShiftBlockDto> ShiftTimeline { get; set; } = new List<DashboardShiftBlockDto>();

	public List<DashboardWorkingEmployeeDto> CurrentlyWorking { get; set; } = new List<DashboardWorkingEmployeeDto>();

	public DashboardLaborDto Labor { get; set; } = new DashboardLaborDto();

	public List<DashboardDayTrendDto> Last7Days { get; set; } = new List<DashboardDayTrendDto>();

	public List<DashboardEmployeeRankDto> TopDiligent { get; set; } = new List<DashboardEmployeeRankDto>();

	public List<DashboardEmployeeRankDto> TopViolations { get; set; } = new List<DashboardEmployeeRankDto>();

	public StoreAttendanceScoreDto? StoreScore { get; set; }
}
