namespace WorkforceManagement.Api.Services;

public static class AttendanceReviewStatuses
{
	public const string Open = "Open";

	public const string PendingReview = "PendingReview";

	public const string Confirmed = "Confirmed";

	public static string Label(string? status)
	{
		return status switch
		{
			"Open" => "Đang ca", 
			"PendingReview" => "Chờ QL duyệt", 
			"Confirmed" => "Đã duyệt", 
			_ => status ?? "", 
		};
	}
}
