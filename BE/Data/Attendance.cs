using System;
using WorkforceManagement.Api.Services;

namespace WorkforceManagement.Api.Data;

public class Attendance
{
	public int Id { get; set; }

	public int EmployeeId { get; set; }

	public int StoreId { get; set; }

	public DateOnly WorkDate { get; set; }

	public TimeOnly CheckIn { get; set; }

	public TimeOnly? CheckOut { get; set; }

	public decimal OvertimeHours { get; set; }

	public string Status { get; set; } = "Worked";

	public string? Note { get; set; }

	public string ReviewStatus { get; set; } = "Confirmed";

	public int? ShiftRegistrationId { get; set; }

	public TimeOnly? ActualCheckIn { get; set; }

	public TimeOnly? ActualCheckOut { get; set; }

	public int EditCount { get; set; }

	public bool FlaggedForReview { get; set; }

	public int CreatedBy { get; set; }

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public int? UpdatedBy { get; set; }

	public DateTime? UpdatedAt { get; set; }

	public bool IsOpen
	{
		get
		{
			if (ReviewStatus == "Open")
			{
				return Status == "Worked";
			}
			return false;
		}
	}

	public decimal WorkedHours
	{
		get
		{
			if (!CheckOut.HasValue)
			{
				return 0m;
			}
			return AttendanceRules.CalcWorkedHours(CheckIn, CheckOut.Value);
		}
	}

	public Employee Employee { get; set; }

	public Store Store { get; set; }

	public User CreatedByUser { get; set; }

	public User? UpdatedByUser { get; set; }
}
