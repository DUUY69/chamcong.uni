namespace WorkforceManagement.Api.Services;

public static class AttendanceStatuses
{
	public const string Worked = "Worked";

	public const string Absent = "Absent";

	public static string Label(string? status)
	{
		if (!(status == "Worked"))
		{
			if (status == "Absent")
			{
				return "Không đi làm";
			}
			return status ?? "";
		}
		return "Đi làm";
	}

	public static bool IsValid(string? status)
	{
		if (!(status == "Worked"))
		{
			return status == "Absent";
		}
		return true;
	}
}
