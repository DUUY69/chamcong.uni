using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Models.Dashboard;
using WorkforceManagement.Api.Models.Shift;

namespace WorkforceManagement.Api.Services;

public static class OperationsDashboardService
{
	private sealed class EmpBlock
	{
		public int EmployeeId { get; set; }

		public string EmployeeName { get; set; } = "";

		public int StoreId { get; set; }

		public string StoreName { get; set; } = "";

		public TimeOnly Start { get; set; }

		public TimeOnly End { get; set; }

		public int FirstRegId { get; set; }
	}

	private static readonly TimeSpan LateGrace = TimeSpan.FromMinutes(5.0);

	private static readonly TimeSpan MissingGrace = TimeSpan.FromMinutes(15.0);

	public static async Task<OperationsDashboardDto> BuildAsync(AppDbContext db, DateOnly workDate, IReadOnlyList<int>? storeIds, int? filterStoreId)
	{
		List<Store> stores = await (from s in db.Stores.AsNoTracking()
			where s.IsActive
			where storeIds == null || storeIds.Contains(s.Id)
			where !((int?)filterStoreId).HasValue || s.Id == ((int?)filterStoreId).Value
			orderby s.Name
			select s).ToListAsync();
		if (stores.Count == 0)
		{
			return new OperationsDashboardDto
			{
				WorkDate = workDate.ToString("yyyy-MM-dd")
			};
		}
		HashSet<int> storeIdSet = stores.Select((Store s) => s.Id).ToHashSet();
		DateOnly trendFrom = workDate.AddDays(-6);
		DateOnly scoreFrom = workDate.AddDays(-6);
		List<ShiftRegistration> shiftRegs = await (from r in db.ShiftRegistrations.AsNoTracking().Include((ShiftRegistration r) => r.Employee).ThenInclude((Employee e) => e.User)
				.Include((ShiftRegistration r) => r.Employee)
				.ThenInclude((Employee e) => e.SalaryCoefficients)
				.Include((ShiftRegistration r) => r.Store)
			where r.WorkDate >= scoreFrom && r.WorkDate <= workDate && r.Status == "Approved" && storeIdSet.Contains(r.StoreId)
			select r).ToListAsync();
		List<Attendance> list = await (from a in db.Attendances.AsNoTracking().Include((Attendance a) => a.Employee).ThenInclude((Employee e) => e.SalaryCoefficients)
				.Include((Attendance a) => a.Store)
			where a.WorkDate >= scoreFrom && a.WorkDate <= workDate && storeIdSet.Contains(a.StoreId)
			select a).ToListAsync();
		List<ShiftRegistration> list2 = shiftRegs.Where((ShiftRegistration r) => r.WorkDate == workDate).ToList();
		List<Attendance> list3 = list.Where((Attendance a) => a.WorkDate == workDate).ToList();
		TimeOnly now = TimeOnly.FromDateTime(DateTime.Now);
		bool isToday = workDate == DateOnly.FromDateTime(DateTime.Today);
		List<EmpBlock> todayBlocks = BuildEmployeeBlocks(list2);
		List<DayLaborSummaryDto> list4 = (from x in ShiftScheduleService.BuildDayLaborSummaries(list2, stores, workDate, workDate)
			where storeIdSet.Contains(x.StoreId)
			select x).ToList();
		OperationsDashboardDto operationsDashboardDto = new OperationsDashboardDto
		{
			WorkDate = workDate.ToString("yyyy-MM-dd"),
			StoreId = filterStoreId,
			StoreName = ((!filterStoreId.HasValue) ? null : stores.FirstOrDefault()?.Name),
			Kpi = new DashboardKpiDto
			{
				TotalScheduled = todayBlocks.Select((EmpBlock b) => b.EmployeeId).Distinct().Count(),
				CheckedIn = list3.Count(delegate(Attendance a)
				{
					bool flag = a.Status == "Worked";
					bool flag2 = flag;
					if (flag2)
					{
						bool flag3;
						switch (a.ReviewStatus)
						{
						case "Open":
						case "PendingReview":
						case "Confirmed":
							flag3 = true;
							break;
						default:
							flag3 = false;
							break;
						}
						flag2 = flag3;
					}
					return flag2;
				}),
				Late = CountLateToday(todayBlocks, list3),
				OnLeave = list3.Count((Attendance a) => a.Status == "Absent" && a.ReviewStatus == "Confirmed"),
				TodayLaborCost = list4.Sum((DayLaborSummaryDto x) => x.EmployeeEstPay + x.ManagerEstPay)
			},
			MissingCheckIn = BuildMissingCheckIn(todayBlocks, list3, isToday, now),
			ShiftTimeline = BuildTimeline(todayBlocks, list3),
			CurrentlyWorking = (from x in list3.Where((Attendance a) => a.ReviewStatus == "Open" && a.ActualCheckIn.HasValue).Select(delegate(Attendance a)
				{
					EmpBlock empBlock = todayBlocks.FirstOrDefault((EmpBlock b) => b.EmployeeId == a.EmployeeId && b.StoreId == a.StoreId);
					return new DashboardWorkingEmployeeDto
					{
						EmployeeId = a.EmployeeId,
						EmployeeName = (a.Employee?.FullName ?? ""),
						StoreName = (a.Store?.Name ?? ""),
						Since = a.ActualCheckIn.Value.ToString("HH:mm"),
						ScheduledEnd = (empBlock?.End.ToString("HH:mm") ?? "—")
					};
				})
				orderby x.Since
				select x).ToList(),
			Labor = BuildLabor(stores, list2, list3, list4),
			Last7Days = Build7DayTrend(trendFrom, workDate, shiftRegs, list, stores, storeIdSet),
			Alerts = BuildAlerts(todayBlocks, list3, stores, list2, isToday, now)
		};
		operationsDashboardDto.TopDiligent = BuildTopDiligent(list, shiftRegs, scoreFrom, workDate);
		operationsDashboardDto.TopViolations = BuildTopViolations(list, shiftRegs, scoreFrom, workDate);
		operationsDashboardDto.StoreScore = BuildStoreScore(scoreFrom, workDate, shiftRegs, list, stores, storeIdSet);
		return operationsDashboardDto;
	}

	private static List<EmpBlock> BuildEmployeeBlocks(List<ShiftRegistration> regs)
	{
		List<EmpBlock> list = new List<EmpBlock>();
		foreach (IGrouping<(int, int), ShiftRegistration> item in from r in regs
			group r by (EmployeeId: r.EmployeeId, StoreId: r.StoreId))
		{
			List<ShiftBlockMerge.Block> list2 = ShiftBlockMerge.MergeAdjacent(item.OrderBy((ShiftRegistration r) => r.StartTime));
			foreach (ShiftBlockMerge.Block b in list2)
			{
				ShiftRegistration shiftRegistration = item.First((ShiftRegistration r) => r.Id == b.FirstRegistrationId);
				list.Add(new EmpBlock
				{
					EmployeeId = shiftRegistration.EmployeeId,
					EmployeeName = (shiftRegistration.Employee?.FullName ?? ""),
					StoreId = b.StoreId,
					StoreName = b.StoreName,
					Start = b.StartTime,
					End = b.EndTime,
					FirstRegId = b.FirstRegistrationId
				});
			}
		}
		return list;
	}

	private static int CountLateToday(List<EmpBlock> blocks, List<Attendance> attList)
	{
		int num = 0;
		foreach (EmpBlock block in blocks)
		{
			Attendance attendance = FindAttForBlock(attList, block);
			if (attendance != null && attendance.ActualCheckIn.HasValue && !(attendance.Status != "Worked") && attendance.ActualCheckIn.Value > block.Start.Add(LateGrace))
			{
				num++;
			}
		}
		return num;
	}

	private static List<DashboardMissingCheckInDto> BuildMissingCheckIn(List<EmpBlock> blocks, List<Attendance> attList, bool isToday, TimeOnly now)
	{
		List<DashboardMissingCheckInDto> list = new List<DashboardMissingCheckInDto>();
		foreach (EmpBlock block in blocks)
		{
			if (FindAttForBlock(attList, block) == null && (!isToday || !(now < block.Start.Add(MissingGrace))))
			{
				list.Add(new DashboardMissingCheckInDto
				{
					EmployeeId = block.EmployeeId,
					EmployeeName = block.EmployeeName,
					StoreName = block.StoreName,
					ScheduledStart = block.Start.ToString("HH:mm"),
					ScheduledEnd = block.End.ToString("HH:mm")
				});
			}
		}
		return (from x in list
			orderby x.ScheduledStart, x.EmployeeName
			select x).ToList();
	}

	private static List<DashboardShiftBlockDto> BuildTimeline(List<EmpBlock> blocks, List<Attendance> attList)
	{
		return (from b in blocks
			group b by (Start: b.Start, End: b.End) into g
			orderby g.Key.Start
			select new DashboardShiftBlockDto
			{
				Start = g.Key.Start.ToString("HH:mm"),
				End = g.Key.End.ToString("HH:mm"),
				ScheduledCount = g.Count(),
				CheckedInCount = g.Count((EmpBlock b) => FindAttForBlock(attList, b) != null)
			}).ToList();
	}

	private static DashboardLaborDto BuildLabor(List<Store> stores, List<ShiftRegistration> todayRegs, List<Attendance> todayAtt, List<DayLaborSummaryDto> laborToday)
	{
		int num = stores.Sum((Store s) => ShiftScheduleService.GetRequiredStaff(s));
		int num2 = todayRegs.Select((ShiftRegistration r) => r.EmployeeId).Distinct().Count();
		decimal d = todayAtt.Where((Attendance a) => a.ReviewStatus == "Confirmed" && a.Status == "Worked").Sum((Attendance a) => EstimateAttPay(a));
		decimal d2 = todayAtt.Where((Attendance a) => a.ReviewStatus == "Confirmed").Sum((Attendance a) => a.OvertimeHours);
		return new DashboardLaborDto
		{
			EstimatedPay = laborToday.Sum((DayLaborSummaryDto x) => x.EmployeeEstPay + x.ManagerEstPay),
			ConfirmedPay = Math.Round(d, 0),
			OvertimeHours = Math.Round(d2, 1),
			RequiredStaff = num,
			ApprovedStaff = num2,
			StaffingFulfillmentPct = ((num > 0) ? Math.Round((decimal)num2 / (decimal)num * 100m, 1) : 0m)
		};
	}

	private static decimal EstimateAttPay(Attendance a)
	{
		if (a.Status != "Worked")
		{
			return 0m;
		}
		decimal num = a.WorkedHours + a.OvertimeHours;
		if (num <= 0m)
		{
			return 0m;
		}
		SalaryCoefficient salaryCoefficient = (from sc in a.Employee?.SalaryCoefficients?.Where((SalaryCoefficient sc) => sc.EffectiveFrom <= a.WorkDate)
			orderby sc.EffectiveFrom descending, sc.CreatedAt descending
			select sc).FirstOrDefault();
		if (salaryCoefficient == null)
		{
			return 0m;
		}
		return Math.Round(num * salaryCoefficient.BaseSalaryPerHour * salaryCoefficient.Coefficient, 0);
	}

	private static Attendance? FindAttForBlock(List<Attendance> list, EmpBlock block)
	{
		return list.FirstOrDefault((Attendance a) => a.EmployeeId == block.EmployeeId && a.StoreId == block.StoreId && (a.ShiftRegistrationId == block.FirstRegId || !a.ShiftRegistrationId.HasValue));
	}

	private static List<DashboardAlertItemDto> BuildAlerts(List<EmpBlock> blocks, List<Attendance> todayAtt, List<Store> stores, List<ShiftRegistration> todayRegs, bool isToday, TimeOnly now)
	{
		List<DashboardAlertItemDto> list = new List<DashboardAlertItemDto>();
		int num = blocks.Count((EmpBlock b) => FindAttForBlock(todayAtt, b) == null && (!isToday || now >= b.Start.Add(MissingGrace)));
		if (num > 0)
		{
			list.Add(new DashboardAlertItemDto
			{
				Level = "warning",
				Message = $"{num} NV có ca nhưng chưa check-in"
			});
		}
		int num2 = todayAtt.Count((Attendance a) => a.ReviewStatus == "Open" && blocks.Any((EmpBlock b) => b.EmployeeId == a.EmployeeId && isToday && now > b.End));
		if (num2 > 0)
		{
			list.Add(new DashboardAlertItemDto
			{
				Level = "warning",
				Message = $"{num2} NV quên checkout (qua giờ ca)"
			});
		}
		int num3 = todayAtt.Count((Attendance a) => a.ReviewStatus == "PendingReview");
		if (num3 > 0)
		{
			list.Add(new DashboardAlertItemDto
			{
				Level = "info",
				Message = $"{num3} ca chờ QL xác nhận giờ"
			});
		}
		int num4 = todayAtt.Count((Attendance a) => a.FlaggedForReview);
		if (num4 > 0)
		{
			list.Add(new DashboardAlertItemDto
			{
				Level = "problem",
				Message = $"{num4} bản ghi bị cờ cảnh báo (sửa giờ nhiều)"
			});
		}
		foreach (Store store in stores)
		{
			int requiredStaff = ShiftScheduleService.GetRequiredStaff(store);
			int num5 = (from r in todayRegs
				where r.StoreId == store.Id
				select r.EmployeeId).Distinct().Count();
			if (num5 < requiredStaff)
			{
				list.Add(new DashboardAlertItemDto
				{
					Level = "warning",
					StoreName = store.Name,
					Message = $"Thiếu nhân sự ({num5}/{requiredStaff} NV)"
				});
			}
		}
		if (list.Count == 0)
		{
			list.Add(new DashboardAlertItemDto
			{
				Level = "ok",
				Message = "Không có cảnh báo bất thường hôm nay"
			});
		}
		return list;
	}

	private static List<DashboardDayTrendDto> Build7DayTrend(DateOnly from, DateOnly to, List<ShiftRegistration> shiftRegs, List<Attendance> attendances, List<Store> stores, HashSet<int> storeIdSet)
	{
		List<DashboardDayTrendDto> list = new List<DashboardDayTrendDto>();
		while (from <= to)
		{
			List<ShiftRegistration> regs = shiftRegs.Where((ShiftRegistration r) => r.WorkDate == from).ToList();
			List<EmpBlock> list2 = BuildEmployeeBlocks(regs);
			List<Attendance> list3 = attendances.Where((Attendance a) => a.WorkDate == from).ToList();
			int num = 0;
			int num2 = 0;
			foreach (EmpBlock item in list2)
			{
				Attendance attendance = FindAttForBlock(list3, item);
				if (attendance != null && !(attendance.Status == "Absent"))
				{
					num++;
					if (attendance.ActualCheckIn.HasValue && attendance.ActualCheckIn.Value > item.Start.Add(LateGrace))
					{
						num2++;
					}
				}
			}
			list.Add(new DashboardDayTrendDto
			{
				Date = from.ToString("yyyy-MM-dd"),
				Present = num,
				Absent = list3.Count((Attendance a) => a.Status == "Absent" && a.ReviewStatus == "Confirmed"),
				Late = num2
			});
			from = from.AddDays(1);
		}
		return list;
	}

	private static List<DashboardEmployeeRankDto> BuildTopDiligent(List<Attendance> attendances, List<ShiftRegistration> shiftRegs, DateOnly from, DateOnly to)
	{
		Dictionary<int, (string Name, int OnTime, int Total)> dictionary = new();
		foreach (IGrouping<(int, DateOnly, int), ShiftRegistration> item in from r in shiftRegs
			where r.WorkDate >= @from && r.WorkDate <= to
			group r by (EmployeeId: r.EmployeeId, WorkDate: r.WorkDate, StoreId: r.StoreId))
		{
			List<ShiftBlockMerge.Block> list = ShiftBlockMerge.MergeAdjacent(item.OrderBy((ShiftRegistration r) => r.StartTime));
			foreach (ShiftBlockMerge.Block block in list)
			{
				ShiftRegistration anchor = item.First((ShiftRegistration r) => r.Id == block.FirstRegistrationId);
				Attendance attendance = attendances.FirstOrDefault((Attendance a) => a.EmployeeId == anchor.EmployeeId && a.StoreId == block.StoreId && a.WorkDate == anchor.WorkDate && a.Status == "Worked" && a.ReviewStatus == "Confirmed");
				if (attendance != null)
				{
					if (!dictionary.ContainsKey(anchor.EmployeeId))
					{
						dictionary[anchor.EmployeeId] = (anchor.Employee?.FullName ?? "", 0, 0);
					}
					(string Name, int OnTime, int Total) tuple = dictionary[anchor.EmployeeId];
					tuple.Total++;
					if (attendance.ActualCheckIn.HasValue && attendance.ActualCheckIn.Value <= block.StartTime.Add(LateGrace))
					{
						tuple.OnTime++;
					}
					dictionary[anchor.EmployeeId] = tuple;
				}
			}
		}
		return (from x in (from x in dictionary
				where x.Value.Total >= 2
				orderby (double)x.Value.OnTime / (double)x.Value.Total descending, x.Value.Total descending
				select x).Take(5)
			select new DashboardEmployeeRankDto
			{
				EmployeeId = x.Key,
				EmployeeName = x.Value.Name,
				Count = x.Value.OnTime,
				Label = $"{x.Value.OnTime}/{x.Value.Total} đúng giờ"
			}).ToList();
	}

	private static List<DashboardEmployeeRankDto> BuildTopViolations(List<Attendance> attendances, List<ShiftRegistration> shiftRegs, DateOnly from, DateOnly to)
	{
		Dictionary<int, (string Name, int Count)> violations = new Dictionary<int, (string, int)>();
		foreach (IGrouping<(int, DateOnly, int), ShiftRegistration> item in from r in shiftRegs
			where r.WorkDate >= @from && r.WorkDate <= to
			group r by (EmployeeId: r.EmployeeId, WorkDate: r.WorkDate, StoreId: r.StoreId))
		{
			List<ShiftBlockMerge.Block> list = ShiftBlockMerge.MergeAdjacent(item.OrderBy((ShiftRegistration r) => r.StartTime));
			foreach (ShiftBlockMerge.Block block in list)
			{
				ShiftRegistration anchor = item.First((ShiftRegistration r) => r.Id == block.FirstRegistrationId);
				Attendance attendance = attendances.FirstOrDefault((Attendance a) => a.EmployeeId == anchor.EmployeeId && a.StoreId == block.StoreId && a.WorkDate == anchor.WorkDate);
				if (attendance == null && anchor.WorkDate < DateOnly.FromDateTime(DateTime.Today))
				{
					Add(anchor.EmployeeId, anchor.Employee?.FullName ?? "");
				}
				else if (attendance?.Status == "Absent")
				{
					Add(attendance.EmployeeId, attendance.Employee?.FullName ?? "");
				}
				else if (attendance != null && attendance.ActualCheckIn.HasValue && attendance.ActualCheckIn > block.StartTime.Add(LateGrace))
				{
					Add(attendance.EmployeeId, attendance.Employee?.FullName ?? "");
				}
				if (attendance != null && attendance.FlaggedForReview)
				{
					Add(attendance.EmployeeId, attendance.Employee?.FullName ?? "");
				}
			}
		}
		return violations.OrderByDescending(x => x.Value.Count).Take(5)
			.Select(x => new DashboardEmployeeRankDto
			{
				EmployeeId = x.Key,
				EmployeeName = x.Value.Name,
				Count = x.Value.Count,
				Label = $"{x.Value.Count} lần"
			}).ToList();
		void Add(int empId, string name, int n = 1)
		{
			if (!violations.ContainsKey(empId))
			{
				violations[empId] = (name, 0);
			}
			(string, int) tuple = violations[empId];
			violations[empId] = (tuple.Item1, tuple.Item2 + n);
		}
	}

	private static StoreAttendanceScoreDto BuildStoreScore(DateOnly from, DateOnly to, List<ShiftRegistration> shiftRegs, List<Attendance> attendances, List<Store> stores, HashSet<int> storeIdSet)
	{
		int num = 0;
		int num2 = 0;
		int num3 = 0;
		int num4 = 0;
		decimal num5 = default(decimal);
		decimal num6 = default(decimal);
		foreach (IGrouping<(int, DateOnly, int), ShiftRegistration> item in from r in shiftRegs
			where r.WorkDate >= @from && r.WorkDate <= to
			group r by (EmployeeId: r.EmployeeId, WorkDate: r.WorkDate, StoreId: r.StoreId))
		{
			List<ShiftBlockMerge.Block> list = ShiftBlockMerge.MergeAdjacent(item.OrderBy((ShiftRegistration r) => r.StartTime));
			foreach (ShiftBlockMerge.Block block in list)
			{
				num++;
				ShiftRegistration anchor = item.First((ShiftRegistration r) => r.Id == block.FirstRegistrationId);
				Attendance attendance = attendances.FirstOrDefault((Attendance a) => a.EmployeeId == anchor.EmployeeId && a.StoreId == block.StoreId && a.WorkDate == anchor.WorkDate);
				if (attendance == null)
				{
					continue;
				}
				if (attendance.Status == "Absent")
				{
					num3++;
				}
				else if (!(attendance.Status != "Worked"))
				{
					num4++;
					num6 += attendance.WorkedHours;
					num5 += attendance.OvertimeHours;
					if (attendance.ActualCheckIn.HasValue && attendance.ActualCheckIn.Value <= block.StartTime.Add(LateGrace))
					{
						num2++;
					}
				}
			}
		}
		List<DayStaffingSummaryDto> list2 = (from s in ShiftScheduleService.BuildStaffingSummaries(shiftRegs.Where((ShiftRegistration r) => r.WorkDate >= @from && r.WorkDate <= to).ToList(), stores, @from, to)
			where storeIdSet.Contains(s.StoreId) && s.Required > 0
			select s).ToList();
		decimal num7 = ((list2.Count > 0) ? list2.Average((DayStaffingSummaryDto s) => Math.Min(100m, (decimal)s.ApprovedCount / (decimal)s.Required * 100m)) : 100m);
		decimal num8 = ((num4 > 0) ? ((decimal)num2 / (decimal)num4 * 100m) : 100m);
		decimal num9 = ((num > 0) ? ((decimal)num3 / (decimal)num * 100m) : 0m);
		decimal num10 = ((num6 > 0m) ? (num5 / num6 * 100m) : 0m);
		int value = (int)Math.Round(num8 * 0.35m + num7 * 0.30m + Math.Max(0m, 100m - num10 * 2m) * 0.15m + Math.Max(0m, 100m - num9 * 3m) * 0.20m);
		value = Math.Clamp(value, 0, 100);
		return new StoreAttendanceScoreDto
		{
			Score = value,
			OnTimeRate = Math.Round(num8, 1),
			StaffingRate = Math.Round(num7, 1),
			OvertimeRate = Math.Round(num10, 1),
			AbsenceRate = Math.Round(num9, 1)
		};
	}
}
