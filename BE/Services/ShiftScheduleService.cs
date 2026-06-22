using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Models.Shift;

namespace WorkforceManagement.Api.Services;

public static class ShiftScheduleService
{
	public const int DefaultRequiredStaffPerDay = 5;

	public const int MaxStaffPerSlot = 4;

	public static int GetRequiredStaff(Store? store)
	{
		if (store == null || store.RequiredStaffPerDay <= 0)
		{
			return 5;
		}
		return store.RequiredStaffPerDay;
	}

	public static async Task<int> CountActiveInSlotAsync(AppDbContext db, int storeId, DateOnly workDate, TimeOnly start, TimeOnly end, int? excludeRegistrationId = null)
	{
		IQueryable<ShiftRegistration> source = db.ShiftRegistrations.Where((ShiftRegistration r) =>
			r.StoreId == storeId && r.WorkDate == workDate
			&& (r.Status == "Pending" || r.Status == "Approved")
			&& r.StartTime < end && start < r.EndTime);
		if (excludeRegistrationId.HasValue)
		{
			source = source.Where((ShiftRegistration r) => r.Id != ((int?)excludeRegistrationId).Value);
		}
		return await source.CountAsync();
	}

	public static async Task<int> CountApprovedEmployeesAsync(AppDbContext db, int storeId, DateOnly workDate, int? excludeRegistrationId = null)
	{
		IQueryable<ShiftRegistration> source = db.ShiftRegistrations.Where((ShiftRegistration r) => r.StoreId == storeId && r.WorkDate == workDate && r.Status == "Approved");
		if (excludeRegistrationId.HasValue)
		{
			source = source.Where((ShiftRegistration r) => r.Id != ((int?)excludeRegistrationId).Value);
		}
		return await source.Select((ShiftRegistration r) => r.EmployeeId).Distinct().CountAsync();
	}

	public static async Task<ShiftRegistration?> FindTimeOverlapAsync(AppDbContext db, ShiftRegistration reg, int? excludeRegistrationId = null)
	{
		IQueryable<ShiftRegistration> source = from r in db.ShiftRegistrations.Include((ShiftRegistration r) => r.Store)
			where r.EmployeeId == reg.EmployeeId && r.WorkDate == reg.WorkDate && (r.Status == "Pending" || r.Status == "Approved") && r.StartTime < reg.EndTime && reg.StartTime < r.EndTime
			select r;
		int excludeId = excludeRegistrationId ?? reg.Id;
		source = source.Where((ShiftRegistration r) => r.Id != excludeId);
		var candidates = await source.ToListAsync();
		foreach (var other in candidates)
		{
			// Cùng CH, cùng ô giờ lưới (06:30–07:30 vs 06:00–07:00) — bản lệch phút, không chặn duyệt
			if (other.StoreId == reg.StoreId
			    && ShiftTimeGrid.SameAlignedHourSlot(reg.StartTime, reg.EndTime, other.StartTime, other.EndTime))
				continue;
			return other;
		}
		return null;
	}

	public static async Task<(bool Ok, string? Error)> CanApproveAsync(AppDbContext db, ShiftRegistration reg)
	{
		ShiftRegistration shiftRegistration = await FindTimeOverlapAsync(db, reg, reg.Id);
		if (shiftRegistration != null)
		{
			string value = shiftRegistration.Store?.Name ?? "cửa hàng khác";
			return (Ok: false, Error: $"Không thể duyệt: trùng giờ với ca tại {value} ({shiftRegistration.StartTime:HH:mm}–{shiftRegistration.EndTime:HH:mm}).");
		}
		return (Ok: true, Error: null);
	}

	public static string ComputeDayStatus(int approved, int required, int pending, int registered)
	{
		if (approved > required)
		{
			return "over";
		}
		if (approved == required)
		{
			if (pending <= 0)
			{
				return "ok";
			}
			return "ok";
		}
		if (approved == 0 && registered == 0)
		{
			return "none";
		}
		return "under";
	}

	public static List<DayStaffingSummaryDto> BuildStaffingSummaries(IEnumerable<ShiftRegistration> regs, IEnumerable<Store> stores, DateOnly from, DateOnly to)
	{
		Dictionary<int, Store> dictionary = stores.ToDictionary((Store s) => s.Id);
		Dictionary<(int, DateOnly), List<ShiftRegistration>> dictionary2 = (from r in regs.Where(delegate(ShiftRegistration r)
			{
				string status = r.Status;
				return (status == "Pending" || status == "Approved") ? true : false;
			})
			group r by (StoreId: r.StoreId, WorkDate: r.WorkDate)).ToDictionary((IGrouping<(int StoreId, DateOnly WorkDate), ShiftRegistration> g) => g.Key, (IGrouping<(int StoreId, DateOnly WorkDate), ShiftRegistration> g) => g.ToList());
		List<DayStaffingSummaryDto> list = new List<DayStaffingSummaryDto>();
		foreach (Store store in stores)
		{
			int requiredStaff = GetRequiredStaff(store);
			DateOnly dateOnly = from;
			while (dateOnly <= to)
			{
				dictionary2.TryGetValue((store.Id, dateOnly), out var value);
				if (value == null)
				{
					value = new List<ShiftRegistration>();
				}
				List<int> list2 = (from r in value
					where r.Status == "Approved"
					select r.EmployeeId).Distinct().ToList();
				List<int> list3 = (from r in value
					where r.Status == "Pending"
					select r.EmployeeId).Distinct().ToList();
				int num = value.Select((ShiftRegistration r) => r.EmployeeId).Distinct().Count();
				int count = list2.Count;
				int count2 = list3.Count;
				list.Add(new DayStaffingSummaryDto
				{
					Date = dateOnly.ToString("yyyy-MM-dd"),
					StoreId = store.Id,
					Required = requiredStaff,
					ApprovedCount = count,
					PendingCount = count2,
					RegisteredCount = num,
					Status = ComputeDayStatus(count, requiredStaff, count2, num)
				});
				dateOnly = dateOnly.AddDays(1);
			}
		}
		return (from x in list
			orderby x.Date, x.StoreId
			select x).ToList();
	}

	public static List<DayLaborSummaryDto> BuildDayLaborSummaries(IEnumerable<ShiftRegistration> regs, IEnumerable<Store> stores, DateOnly from, DateOnly to)
	{
		List<ShiftRegistration> source = regs.Where((ShiftRegistration r) => r.Status == "Approved").ToList();
		List<DayLaborSummaryDto> list = new List<DayLaborSummaryDto>();
		foreach (Store store in stores)
		{
			decimal standardHoursPerDay = ((store.StandardWorkHoursPerDay > 0m) ? store.StandardWorkHoursPerDay : 8m);
			DateOnly d = from;
			while (d <= to)
			{
				List<ShiftRegistration> list2 = source.Where((ShiftRegistration r) => r.StoreId == store.Id && r.WorkDate == d).ToList();
				decimal d2 = default(decimal);
				decimal d3 = default(decimal);
				decimal d4 = default(decimal);
				decimal d5 = default(decimal);
				foreach (ShiftRegistration item in list2)
				{
					decimal num = ShiftHours(item.StartTime, item.EndTime);
					if (!(num <= 0m))
					{
						string text = item.Employee?.User?.Role ?? "Employee";
						SalaryCoefficient coeff = EffectiveCoefficient(item.Employee?.SalaryCoefficients, d);
						decimal num2 = EstimateShiftPay(coeff, num, standardHoursPerDay);
						if (text == "Manager")
						{
							d3 += num;
							d5 += num2;
						}
						else
						{
							d2 += num;
							d4 += num2;
						}
					}
				}
				list.Add(new DayLaborSummaryDto
				{
					Date = d.ToString("yyyy-MM-dd"),
					StoreId = store.Id,
					EmployeeHours = Math.Round(d2, 2),
					ManagerHours = Math.Round(d3, 2),
					EmployeeEstPay = Math.Round(d4, 0),
					ManagerEstPay = Math.Round(d5, 0)
				});
				d = d.AddDays(1);
			}
		}
		return (from x in list
			orderby x.Date, x.StoreId
			select x).ToList();
	}

	private static decimal ShiftHours(TimeOnly start, TimeOnly end)
	{
		return (decimal)(end.ToTimeSpan() - start.ToTimeSpan()).TotalHours;
	}

	private static SalaryCoefficient? EffectiveCoefficient(IEnumerable<SalaryCoefficient>? coefficients, DateOnly workDate)
	{
		return (from sc in coefficients?.Where((SalaryCoefficient sc) => sc.EffectiveFrom <= workDate)
			orderby sc.EffectiveFrom descending, sc.CreatedAt descending
			select sc).FirstOrDefault();
	}

	private static decimal EstimateShiftPay(SalaryCoefficient? coeff, decimal hours, decimal standardHoursPerDay)
	{
		if (coeff == null || hours <= 0m)
		{
			return 0m;
		}
		if (coeff.SalaryType == "Monthly")
		{
			decimal num = coeff.BaseSalaryPerHour / 26m;
			return Math.Round(num * hours / standardHoursPerDay, 0);
		}
		return Math.Round(hours * coeff.BaseSalaryPerHour * coeff.Coefficient, 0);
	}
}
