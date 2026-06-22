using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;

namespace WorkforceManagement.Api.Services;

public static class AttendanceRules
{
	public static async Task<decimal> GetStandardHoursAsync(AppDbContext db, int employeeId, int storeId, DateOnly workDate, int? shiftRegistrationId = null, CancellationToken ct = default(CancellationToken))
	{
		List<ShiftRegistration> list = await (from r in db.ShiftRegistrations.AsNoTracking()
			where r.EmployeeId == employeeId && r.StoreId == storeId && r.WorkDate == workDate && r.Status == "Approved"
			orderby r.StartTime
			select r).ToListAsync(ct);
		if (list.Count > 0)
		{
			List<ShiftBlockMerge.Block> list2 = ShiftBlockMerge.MergeAdjacent(list);
			if (shiftRegistrationId.HasValue)
			{
				ShiftBlockMerge.Block block = ShiftBlockMerge.FindBlockContaining(list2, shiftRegistrationId.Value);
				if (block != null)
				{
					return CalcWorkedHours(block.StartTime, block.EndTime);
				}
				ShiftRegistration shiftRegistration = list.FirstOrDefault((ShiftRegistration r) => r.Id == shiftRegistrationId.Value);
				if (shiftRegistration != null)
				{
					return CalcWorkedHours(shiftRegistration.StartTime, shiftRegistration.EndTime);
				}
			}
			if (list2.Count == 1)
			{
				return CalcWorkedHours(list2[0].StartTime, list2[0].EndTime);
			}
		}
		var anon = await (from s in db.Stores.AsNoTracking()
			where s.Id == storeId
			select new { s.StandardWorkHoursPerDay }).FirstOrDefaultAsync(ct);
		if (anon == null)
		{
			throw new InvalidOperationException($"Không tìm thấy cửa hàng Id={storeId} trong DB.");
		}
		if (anon.StandardWorkHoursPerDay <= 0m)
		{
			throw new InvalidOperationException($"Cửa hàng Id={storeId} chưa cấu hình StandardWorkHoursPerDay hợp lệ trong DB.");
		}
		return anon.StandardWorkHoursPerDay;
	}

	public static async Task<(decimal StandardHours, decimal OtMultiplier, string? ShiftName)> GetWorkContextAsync(AppDbContext db, int employeeId, int storeId, DateOnly workDate, CancellationToken ct = default(CancellationToken))
	{
		ShiftRegistration shiftReg = await (from r in db.ShiftRegistrations.Include((ShiftRegistration r) => r.Shift)
			where r.EmployeeId == employeeId && r.StoreId == storeId && r.WorkDate == workDate && r.Status == "Approved"
			select r).FirstOrDefaultAsync(ct);
		Store store = (await db.Stores.AsNoTracking().FirstOrDefaultAsync((Store s) => s.Id == storeId, ct)) ?? throw new InvalidOperationException($"Không tìm thấy cửa hàng Id={storeId} trong DB.");
		if (shiftReg != null)
		{
			TimeSpan timeSpan = shiftReg.EndTime.ToTimeSpan() - shiftReg.StartTime.ToTimeSpan();
			string item = shiftReg.Shift?.Name ?? $"{shiftReg.StartTime:HH\\:mm}–{shiftReg.EndTime:HH\\:mm}";
			return (StandardHours: Math.Round((decimal)timeSpan.TotalHours, 2), OtMultiplier: store.OvertimeRateMultiplier, ShiftName: item);
		}
		return (StandardHours: store.StandardWorkHoursPerDay, OtMultiplier: store.OvertimeRateMultiplier, ShiftName: null);
	}

	public static decimal CalcWorkedHours(TimeOnly checkIn, TimeOnly checkOut)
	{
		if (checkOut <= checkIn)
		{
			return 0m;
		}
		return Math.Round((decimal)(checkOut.ToTimeSpan() - checkIn.ToTimeSpan()).TotalHours, 2);
	}

	public static decimal CalcOvertimeHours(decimal workedHours, decimal standardHours)
	{
		return Math.Max(0m, Math.Round(workedHours - standardHours, 2));
	}

	public static TimeOnly EffectiveCheckIn(TimeOnly scheduledStart, TimeOnly actualPunch)
	{
		if (!(actualPunch < scheduledStart))
		{
			return actualPunch;
		}
		return scheduledStart;
	}

	public static TimeOnly EffectiveCheckOut(TimeOnly scheduledEnd, TimeOnly actualPunch)
	{
		if (!(actualPunch >= scheduledEnd))
		{
			return actualPunch;
		}
		return scheduledEnd;
	}

	public static (TimeOnly CheckIn, TimeOnly CheckOut) ResolveFinalTimes(TimeOnly scheduledStart, TimeOnly scheduledEnd, TimeOnly actualIn, TimeOnly actualOut)
	{
		TimeOnly timeOnly = EffectiveCheckIn(scheduledStart, actualIn);
		TimeOnly timeOnly2 = EffectiveCheckOut(scheduledEnd, actualOut);
		if (timeOnly2 <= timeOnly)
		{
			timeOnly2 = ((actualOut > timeOnly) ? actualOut : scheduledEnd);
		}
		return (CheckIn: timeOnly, CheckOut: timeOnly2);
	}

	public static void ApplyWorkedTimes(Attendance record, TimeOnly checkIn, TimeOnly checkOut, decimal standardHours)
	{
		record.CheckIn = checkIn;
		record.CheckOut = checkOut;
		record.Status = "Worked";
		decimal workedHours = CalcWorkedHours(checkIn, checkOut);
		record.OvertimeHours = CalcOvertimeHours(workedHours, standardHours);
	}
}
