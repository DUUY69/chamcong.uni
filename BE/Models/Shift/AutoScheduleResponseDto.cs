namespace WorkforceManagement.Api.Models.Shift;

public class AutoScheduleResponseDto
{
	public int ResetCount { get; set; }

	public int PendingFound { get; set; }

	public int ApprovedCount { get; set; }

	public int RejectedCount { get; set; }

	public int SkippedCapacity { get; set; }

	public int SkippedConflict { get; set; }

	public string Message { get; set; } = "";
}
