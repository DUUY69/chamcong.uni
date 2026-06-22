using System;

namespace WorkforceManagement.Api.Services;

public static class ShiftSlotRules
{
	public enum SlotPreference
	{
		Morning,
		Afternoon,
		Flexible
	}

	public static readonly (TimeOnly Start, TimeOnly End, string Label) Morning = (Start: new TimeOnly(6, 0), End: new TimeOnly(14, 0), Label: "Ca sáng");

	public static readonly (TimeOnly Start, TimeOnly End, string Label) Afternoon = (Start: new TimeOnly(14, 0), End: new TimeOnly(22, 0), Label: "Ca chiều");

	public static readonly (TimeOnly Start, TimeOnly End, string Label) FullDay = (Start: new TimeOnly(8, 0), End: new TimeOnly(17, 0), Label: "Ca full ngày");

	public static readonly (TimeOnly Start, TimeOnly End, string Label)[] GridSlots = new(TimeOnly, TimeOnly, string)[2] { Morning, Afternoon };

	public static string AllowedShiftsMessage => "Khung giờ không hợp lệ.";

	public static string LabelFor(TimeOnly start, TimeOnly end)
	{
		if (start == Morning.Start && end == Morning.End)
		{
			return Morning.Label;
		}
		if (start == Afternoon.Start && end == Afternoon.End)
		{
			return Afternoon.Label;
		}
		if (!(start == FullDay.Start) || !(end == FullDay.End))
		{
			return $"{start:HH\\:mm}–{end:HH\\:mm}";
		}
		return FullDay.Label;
	}

	public static bool Overlaps(TimeOnly regStart, TimeOnly regEnd, TimeOnly slotStart, TimeOnly slotEnd)
	{
		if (regStart < slotEnd)
		{
			return slotStart < regEnd;
		}
		return false;
	}

	public static bool IsAllowedShift(TimeOnly start, TimeOnly end)
	{
		return true;
	}

	public static bool SpansBothGridSlots(TimeOnly start, TimeOnly end)
	{
		if (Overlaps(start, end, Morning.Start, Morning.End) && Overlaps(start, end, Afternoon.Start, Afternoon.End) && (!(start == Morning.Start) || !(end == Morning.End)))
		{
			if (start == Afternoon.Start)
			{
				return !(end == Afternoon.End);
			}
			return true;
		}
		return false;
	}

	public static SlotPreference ClassifyRegistration(TimeOnly start, TimeOnly end)
	{
		if (start == Morning.Start && end == Morning.End)
		{
			return SlotPreference.Morning;
		}
		if (start == Afternoon.Start && end == Afternoon.End)
		{
			return SlotPreference.Afternoon;
		}
		bool flag = Overlaps(start, end, Morning.Start, Morning.End);
		bool flag2 = Overlaps(start, end, Afternoon.Start, Afternoon.End);
		if (flag && !flag2)
		{
			return SlotPreference.Morning;
		}
		if (flag2 && !flag)
		{
			return SlotPreference.Afternoon;
		}
		if (flag && flag2)
		{
			return SlotPreference.Flexible;
		}
		if (!(start < Afternoon.Start))
		{
			return SlotPreference.Afternoon;
		}
		return SlotPreference.Morning;
	}

	public static (TimeOnly Start, TimeOnly End, string Label) ParentBlockFor(TimeOnly hourStart, TimeOnly hourEnd)
	{
		bool flag = Overlaps(hourStart, hourEnd, Morning.Start, Morning.End);
		bool flag2 = Overlaps(hourStart, hourEnd, Afternoon.Start, Afternoon.End);
		if (flag2 && !flag)
		{
			return Afternoon;
		}
		if (flag && !flag2)
		{
			return Morning;
		}
		if (!(hourStart >= Afternoon.Start))
		{
			return Morning;
		}
		return Afternoon;
	}
}
