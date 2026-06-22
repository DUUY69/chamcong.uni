using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;

namespace WorkforceManagement.Api.Services;

public static class AutoScheduleService
{
	public static async Task<AutoScheduleResult> RunAsync(AppDbContext db, int storeId, DateOnly dateFrom, DateOnly dateTo, int reviewerUserId)
	{
		AutoScheduleResult result = new AutoScheduleResult();
		List<ShiftRegistration> list = await (from r in db.ShiftRegistrations
			where r.StoreId == storeId && r.WorkDate >= dateFrom && r.WorkDate <= dateTo && (r.Status == "Pending" || r.Status == "Approved")
			orderby r.WorkDate, r.CreatedAt
			select r).ToListAsync();
		if (list.Count == 0)
		{
			result.Message = "Tuần này chưa có đăng ký ca nào.";
			return result;
		}
		foreach (ShiftRegistration item in list.Where((ShiftRegistration r) => r.Status == "Approved"))
		{
			item.Status = "Pending";
			item.ReviewedBy = null;
			item.ReviewedAt = null;
			item.RejectReason = null;
			result.ResetCount++;
		}
		result.PendingFound = list.Count;
		DateOnly day = dateFrom;
		while (day <= dateTo)
		{
			ProcessDay(list.Where((ShiftRegistration r) => r.WorkDate == day).ToList(), reviewerUserId, result);
			day = day.AddDays(1);
		}
		await db.SaveChangesAsync();
		result.Message = BuildMessage(result);
		return result;
	}

	private static void ProcessDay(List<ShiftRegistration> dayRegs, int reviewerUserId, AutoScheduleResult result)
	{
		HashSet<int> hashSet = new HashSet<int>();
		HashSet<int> hashSet2 = new HashSet<int>();
		foreach (ShiftRegistration item in from r in dayRegs
			where r.Status == "Pending"
			orderby r.CreatedAt
			select r)
		{
			ShiftSlotRules.SlotPreference pref = ShiftSlotRules.ClassifyRegistration(item.StartTime, item.EndTime);
			List<ShiftSlotRules.SlotPreference> list = SlotsToTry(pref, hashSet.Count, hashSet2.Count);
			bool flag = false;
			foreach (ShiftSlotRules.SlotPreference item2 in list)
			{
				if (TryApproveToSlot(dayRegs, item, item2, hashSet, hashSet2, reviewerUserId, result))
				{
					flag = true;
					break;
				}
			}
			if (!flag)
			{
				result.SkippedCapacity++;
			}
		}
		foreach (ShiftRegistration item3 in dayRegs.Where((ShiftRegistration r) => r.Status == "Pending"))
		{
			item3.Status = "Rejected";
			item3.RejectReason = "Tự xếp lịch: ca đã đủ hoặc trùng lịch";
			item3.ReviewedBy = reviewerUserId;
			item3.ReviewedAt = DateTime.UtcNow;
			result.RejectedCount++;
		}
	}

	private static List<ShiftSlotRules.SlotPreference> SlotsToTry(ShiftSlotRules.SlotPreference pref, int morningCount, int afternoonCount)
	{
		switch (pref)
		{
		case ShiftSlotRules.SlotPreference.Morning:
		{
			int num = 1;
			List<ShiftSlotRules.SlotPreference> list4 = new List<ShiftSlotRules.SlotPreference>(num);
			CollectionsMarshal.SetCount(list4, num);
			CollectionsMarshal.AsSpan(list4)[0] = ShiftSlotRules.SlotPreference.Morning;
			return list4;
		}
		case ShiftSlotRules.SlotPreference.Afternoon:
		{
			int num = 1;
			List<ShiftSlotRules.SlotPreference> list3 = new List<ShiftSlotRules.SlotPreference>(num);
			CollectionsMarshal.SetCount(list3, num);
			CollectionsMarshal.AsSpan(list3)[0] = ShiftSlotRules.SlotPreference.Afternoon;
			return list3;
		}
		default:
		{
			int num;
			if (morningCount <= afternoonCount && morningCount < 4)
			{
				num = 2;
				List<ShiftSlotRules.SlotPreference> list = new List<ShiftSlotRules.SlotPreference>(num);
				CollectionsMarshal.SetCount(list, num);
				Span<ShiftSlotRules.SlotPreference> span = CollectionsMarshal.AsSpan(list);
				span[0] = ShiftSlotRules.SlotPreference.Morning;
				span[1] = ShiftSlotRules.SlotPreference.Afternoon;
				return list;
			}
			num = 2;
			List<ShiftSlotRules.SlotPreference> list2 = new List<ShiftSlotRules.SlotPreference>(num);
			CollectionsMarshal.SetCount(list2, num);
			Span<ShiftSlotRules.SlotPreference> span2 = CollectionsMarshal.AsSpan(list2);
			span2[0] = ShiftSlotRules.SlotPreference.Afternoon;
			span2[1] = ShiftSlotRules.SlotPreference.Morning;
			return list2;
		}
		}
	}

	private static bool TryApproveToSlot(List<ShiftRegistration> dayRegs, ShiftRegistration reg, ShiftSlotRules.SlotPreference slotPref, HashSet<int> morningEmployees, HashSet<int> afternoonEmployees, int reviewerUserId, AutoScheduleResult result)
	{
		if (reg.Status != "Pending")
		{
			return false;
		}
		(TimeOnly, TimeOnly, string) tuple = ((slotPref == ShiftSlotRules.SlotPreference.Morning) ? ShiftSlotRules.Morning : ShiftSlotRules.Afternoon);
		HashSet<int> hashSet = ((slotPref == ShiftSlotRules.SlotPreference.Morning) ? morningEmployees : afternoonEmployees);
		if (hashSet.Count >= 4)
		{
			return false;
		}
		if (hashSet.Contains(reg.EmployeeId))
		{
			return false;
		}
		if (dayRegs.Any((ShiftRegistration r) => r.Id != reg.Id && r.EmployeeId == reg.EmployeeId && r.Status == "Approved"))
		{
			return false;
		}
		reg.StartTime = tuple.Item1;
		reg.EndTime = tuple.Item2;
		if (HasApprovedTimeConflict(dayRegs, reg))
		{
			result.SkippedConflict++;
			return false;
		}
		reg.Status = "Approved";
		reg.ReviewedBy = reviewerUserId;
		reg.ReviewedAt = DateTime.UtcNow;
		reg.RejectReason = null;
		hashSet.Add(reg.EmployeeId);
		result.ApprovedCount++;
		result.ApprovedDetails.Add(new AutoScheduleApprovedItem
		{
			RegistrationId = reg.Id,
			WorkDate = reg.WorkDate.ToString("yyyy-MM-dd"),
			SlotLabel = tuple.Item3,
			StartTime = reg.StartTime.ToString("HH:mm"),
			EndTime = reg.EndTime.ToString("HH:mm")
		});
		return true;
	}

	private static bool HasApprovedTimeConflict(List<ShiftRegistration> dayRegs, ShiftRegistration reg)
	{
		return dayRegs.Any((ShiftRegistration r) => r.Id != reg.Id && r.EmployeeId == reg.EmployeeId && r.Status == "Approved" && r.StartTime < reg.EndTime && reg.StartTime < r.EndTime);
	}

	private static string BuildMessage(AutoScheduleResult result)
	{
		List<string> list = new List<string>();
		if (result.ResetCount > 0)
		{
			list.Add($"Reset {result.ResetCount} ca");
		}
		if (result.ApprovedCount > 0)
		{
			list.Add($"xếp {result.ApprovedCount} ca (≤4 NV/ca, cân bằng sáng/chiều)");
		}
		if (result.RejectedCount > 0)
		{
			list.Add($"từ chối {result.RejectedCount} ca dư");
		}
		if (result.SkippedConflict > 0)
		{
			list.Add($"{result.SkippedConflict} trùng lịch");
		}
		if (list.Count <= 0)
		{
			return "Không có đăng ký ca trong tuần.";
		}
		return string.Join(", ", list) + ".";
	}
}
