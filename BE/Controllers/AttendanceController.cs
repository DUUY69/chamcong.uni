using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Models;
using WorkforceManagement.Api.Models.Attendance;
using WorkforceManagement.Api.Services;

namespace WorkforceManagement.Api.Controllers;

[ApiController]
[Route("api/attendance")]
[Authorize]
public class AttendanceController : ControllerBase
{
	private readonly AppDbContext _db;

	private int CurrentUserId => int.Parse(base.User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ?? "0");

	private string Role => base.User.FindFirstValue("http://schemas.microsoft.com/ws/2008/06/identity/claims/role") ?? "";

	private int? EmployeeId
	{
		get
		{
			string s = base.User.FindFirstValue("employeeId");
			if (!int.TryParse(s, out var result) || result <= 0)
			{
				return null;
			}
			return result;
		}
	}

	public AttendanceController(AppDbContext db)
	{
		_db = db;
	}

	[HttpGet]
	public async Task<IActionResult> GetAll([FromQuery] int? storeId, [FromQuery] int? employeeId, [FromQuery] string? dateFrom, [FromQuery] string? dateTo, [FromQuery] bool? flaggedOnly, [FromQuery] string? reviewStatus)
	{
		IQueryable<Attendance> q = _db.Attendances.Include((Attendance a) => a.Employee).Include((Attendance a) => a.Store).AsQueryable();
		if (Role == "Employee")
		{
			if (!EmployeeId.HasValue)
			{
				return Ok(ApiResponse<List<AttendanceDto>>.Ok(new List<AttendanceDto>()));
			}
			q = q.Where((Attendance a) => a.EmployeeId == EmployeeId.Value);
		}
		else
		{
			UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
			List<int> managedStoreIds = await userStoreScope.GetManagedStoreIdsAsync();
			if (managedStoreIds != null)
			{
				if (managedStoreIds.Count == 0)
				{
					return Ok(ApiResponse<List<AttendanceDto>>.Ok(new List<AttendanceDto>()));
				}
				if (storeId.HasValue && !managedStoreIds.Contains(storeId.Value))
				{
					return StatusCode(403, ApiResponse.Fail("Không có quyền xem cửa hàng này."));
				}
				q = q.Where((Attendance a) => managedStoreIds.Contains(a.StoreId));
			}
			if (employeeId.HasValue)
			{
				q = q.Where((Attendance a) => a.EmployeeId == ((int?)employeeId).Value);
			}
			if (storeId.HasValue)
			{
				q = q.Where((Attendance a) => a.StoreId == ((int?)storeId).Value);
			}
			if (flaggedOnly == true)
			{
				q = q.Where((Attendance a) => a.FlaggedForReview);
			}
		}
		if (!string.IsNullOrWhiteSpace(reviewStatus))
		{
			q = q.Where((Attendance a) => a.ReviewStatus == reviewStatus);
		}
		if (DateOnly.TryParse(dateFrom, out var df))
		{
			q = q.Where((Attendance a) => a.WorkDate >= df);
		}
		if (DateOnly.TryParse(dateTo, out var dt))
		{
			q = q.Where((Attendance a) => a.WorkDate <= dt);
		}
		List<Attendance> list = await (from a in q
			orderby a.WorkDate descending, a.CheckIn descending
			select a).ToListAsync();
		List<AttendanceDto> dtos = new List<AttendanceDto>();
		foreach (Attendance item in list)
		{
			List<AttendanceDto> list2 = dtos;
			list2.Add(await MapDtoAsync(item));
		}
		return Ok(ApiResponse<List<AttendanceDto>>.Ok(dtos));
	}

	[HttpGet("store-alerts")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> GetStoreAlerts([FromQuery] int year, [FromQuery] int month)
	{
		bool flag = ((month < 1 || month > 12) ? true : false);
		if (flag || year < 2000)
		{
			return BadRequest(ApiResponse.Fail("Tháng/năm không hợp lệ."));
		}
		DateOnly dateFrom = new DateOnly(year, month, 1);
		DateOnly dateTo = dateFrom.AddMonths(1).AddDays(-1);
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		List<int> managedStoreIds = await userStoreScope.GetManagedStoreIdsAsync();
		IQueryable<Store> source = _db.Stores.Where((Store s) => s.IsActive);
		if (managedStoreIds != null)
		{
			if (managedStoreIds.Count == 0)
			{
				return Ok(ApiResponse<List<StoreAttendanceAlertDto>>.Ok(new List<StoreAttendanceAlertDto>()));
			}
			source = source.Where((Store s) => managedStoreIds.Contains(s.Id));
		}
		List<Store> stores = await source.OrderBy((Store s) => s.Name).ToListAsync();
		HashSet<int> storeIdSet = stores.Select((Store s) => s.Id).ToHashSet();
		var statMap = (await (from a in _db.Attendances
			where a.WorkDate >= dateFrom && a.WorkDate <= dateTo && storeIdSet.Contains(a.StoreId)
			group a by a.StoreId into g
			select new
			{
				StoreId = g.Key,
				FlaggedCount = g.Count((Attendance x) => x.FlaggedForReview),
				TotalEditCount = g.Sum((Attendance x) => x.EditCount),
				TotalRecords = g.Count()
			}).ToListAsync()).ToDictionary(x => x.StoreId);
		List<StoreAttendanceAlertDto> data = (from x in stores.Select(delegate(Store s)
			{
				statMap.TryGetValue(s.Id, out var value);
				int num = value?.FlaggedCount ?? 0;
				int num2 = value?.TotalEditCount ?? 0;
				var (alertLevel, alertLabel) = ClassifyStoreAlert(num, num2);
				return new StoreAttendanceAlertDto
				{
					StoreId = s.Id,
					StoreName = s.Name,
					FlaggedCount = num,
					TotalEditCount = num2,
					TotalRecords = (value?.TotalRecords ?? 0),
					AlertLevel = alertLevel,
					AlertLabel = alertLabel
				};
			})
			orderby x.AlertLevel == "problem" descending, x.AlertLevel == "warning" descending, x.FlaggedCount descending, x.TotalEditCount descending, x.StoreName
			select x).ToList();
		return Ok(ApiResponse<List<StoreAttendanceAlertDto>>.Ok(data));
	}

	private static (string Level, string Label) ClassifyStoreAlert(int flagged, int edits)
	{
		if (flagged >= 3 || edits >= 8)
		{
			return (Level: "problem", Label: "Cần kiểm tra");
		}
		if (flagged >= 1 || edits >= 3)
		{
			return (Level: "warning", Label: "Theo dõi");
		}
		return (Level: "ok", Label: "Ổn");
	}

	[HttpGet("my-today")]
	[Authorize(Roles = "Employee,Manager")]
	public async Task<IActionResult> GetMyToday([FromQuery] string? workDate)
	{
		return await GetMyDayInternal(workDate);
	}

	[HttpGet("manager-day-board")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> GetManagerDayBoard([FromQuery] string workDate, [FromQuery] int? storeId)
	{
		if (!DateOnly.TryParse(workDate, out var wd))
		{
			return BadRequest(ApiResponse.Fail("workDate không hợp lệ."));
		}
		UserStoreScope scope = new UserStoreScope(_db, base.User);
		List<int> managedStoreIds = await scope.GetManagedStoreIdsAsync();
		if (managedStoreIds != null && managedStoreIds.Count == 0)
		{
			return Ok(ApiResponse<List<ManagerDayBoardItemDto>>.Ok(new List<ManagerDayBoardItemDto>()));
		}
		IQueryable<ShiftRegistration> shiftQ = from r in _db.ShiftRegistrations.Include((ShiftRegistration r) => r.Employee).Include((ShiftRegistration r) => r.Store)
			where r.WorkDate == wd && r.Status == "Approved"
			select r;
		if (Role == "Manager")
		{
			shiftQ = shiftQ.Where((ShiftRegistration r) => r.Employee != null && r.Employee.IsActive);
		}
		if (managedStoreIds != null)
		{
			shiftQ = shiftQ.Where((ShiftRegistration r) => managedStoreIds.Contains(r.StoreId));
		}
		if (storeId.HasValue)
		{
			if (!(await scope.IsStoreFilterAllowedAsync(storeId)))
			{
				return StatusCode(403, ApiResponse.Fail("Không có quyền xem cửa hàng này."));
			}
			shiftQ = shiftQ.Where((ShiftRegistration r) => r.StoreId == ((int?)storeId).Value);
		}
		List<ShiftRegistration> shifts = await (from r in shiftQ
			orderby r.StoreId, r.StartTime
			select r).ToListAsync();
		List<Attendance> attendances = await _db.Attendances.Where((Attendance a) => a.WorkDate == wd).ToListAsync();
		List<ManagerDayBoardItemDto> list = new List<ManagerDayBoardItemDto>();
		foreach (IGrouping<(int, int), ShiftRegistration> item3 in from s in shifts
			group s by (EmployeeId: s.EmployeeId, StoreId: s.StoreId))
		{
			List<ShiftRegistration> list2 = item3.OrderBy((ShiftRegistration r) => r.StartTime).ToList();
			List<ShiftBlockMerge.Block> list3 = ShiftBlockMerge.MergeAdjacent(list2);
			foreach (ShiftBlockMerge.Block block in list3)
			{
				ShiftRegistration shiftRegistration = list2.First((ShiftRegistration r) => r.Id == block.FirstRegistrationId);
				Attendance attendance = AttendanceLookup.FindForRegistration(attendances, list3, shiftRegistration);
				ManagerDayBoardItemDto managerDayBoardItemDto = new ManagerDayBoardItemDto
				{
					ShiftRegistrationId = block.FirstRegistrationId,
					EmployeeId = shiftRegistration.EmployeeId,
					EmployeeName = (shiftRegistration.Employee?.FullName ?? ""),
					EmployeeCode = (shiftRegistration.Employee?.EmployeeCode ?? ""),
					StoreId = block.StoreId,
					StoreName = (shiftRegistration.Store?.Name ?? ""),
					WorkDate = block.WorkDate.ToString("yyyy-MM-dd"),
					ScheduledStart = block.StartTime.ToString("HH:mm"),
					ScheduledEnd = block.EndTime.ToString("HH:mm"),
					ScheduledHours = AttendanceRules.CalcWorkedHours(block.StartTime, block.EndTime),
					AttendanceId = attendance?.Id
				};
				if (attendance == null)
				{
					managerDayBoardItemDto.PunchStatus = "None";
					managerDayBoardItemDto.PunchStatusLabel = "Chưa chấm";
				}
				else
				{
					managerDayBoardItemDto.ActualCheckIn = attendance.ActualCheckIn?.ToString("HH:mm");
					managerDayBoardItemDto.ActualCheckOut = attendance.ActualCheckOut?.ToString("HH:mm");
					ManagerDayBoardItemDto managerDayBoardItemDto2 = managerDayBoardItemDto;
					string reviewStatus = attendance.ReviewStatus;
					string punchStatus;
					if (reviewStatus == "Open")
					{
						punchStatus = "Open";
					}
					else
					{
						string text = reviewStatus;
						if (text == "PendingReview")
						{
							punchStatus = "PendingReview";
						}
						else
						{
							string text2 = reviewStatus;
							punchStatus = ((!(text2 == "Confirmed") || !(attendance.Status == "Absent")) ? "Confirmed" : "Absent");
						}
					}
					managerDayBoardItemDto2.PunchStatus = punchStatus;
					ManagerDayBoardItemDto managerDayBoardItemDto3 = managerDayBoardItemDto;
					string reviewStatus2 = attendance.ReviewStatus;
					if (reviewStatus2 == "Open")
					{
						punchStatus = "Đang làm";
					}
					else
					{
						string text3 = reviewStatus2;
						if (text3 == "PendingReview")
						{
							punchStatus = "Chờ duyệt";
						}
						else
						{
							string text4 = reviewStatus2;
							punchStatus = ((!(text4 == "Confirmed") || !(attendance.Status == "Absent")) ? "Đã duyệt" : "Vắng");
						}
					}
					managerDayBoardItemDto3.PunchStatusLabel = punchStatus;
					if (attendance.ActualCheckIn.HasValue && attendance.ActualCheckOut.HasValue)
					{
						(TimeOnly CheckIn, TimeOnly CheckOut) tuple = AttendanceRules.ResolveFinalTimes(block.StartTime, block.EndTime, attendance.ActualCheckIn.Value, attendance.ActualCheckOut.Value);
						TimeOnly item = tuple.CheckIn;
						TimeOnly item2 = tuple.CheckOut;
						managerDayBoardItemDto.SuggestedCheckIn = item.ToString("HH:mm");
						managerDayBoardItemDto.SuggestedCheckOut = item2.ToString("HH:mm");
						managerDayBoardItemDto.SuggestedHours = AttendanceRules.CalcWorkedHours(item, item2);
					}
					if (attendance.ReviewStatus == "Confirmed")
					{
						managerDayBoardItemDto.ConfirmedCheckIn = attendance.CheckIn.ToString("HH:mm");
						managerDayBoardItemDto.ConfirmedCheckOut = attendance.CheckOut?.ToString("HH:mm");
						if (attendance.Status == "Worked")
						{
							managerDayBoardItemDto.ConfirmedHours = attendance.WorkedHours;
						}
					}
				}
				list.Add(managerDayBoardItemDto);
			}
		}
		list = (from i in list
			orderby i.StoreName, i.EmployeeName, i.ScheduledStart
			select i).ToList();
		return Ok(ApiResponse<List<ManagerDayBoardItemDto>>.Ok(list));
	}

	[HttpPost("end-of-day-confirm")]
	[Authorize(Roles = "Manager")]
	public async Task<IActionResult> EndOfDayConfirm([FromBody] EndOfDayConfirmDto dto)
	{
		if (!DateOnly.TryParse(dto.WorkDate, out var wd))
		{
			return BadRequest(ApiResponse.Fail("workDate không hợp lệ."));
		}
		UserStoreScope scope = new UserStoreScope(_db, base.User);
		IQueryable<Attendance> q = from a in _db.Attendances.Include((Attendance a) => a.Employee).Include((Attendance a) => a.Store)
			where a.WorkDate == wd && a.ReviewStatus == "PendingReview"
			select a;
		if (dto.StoreId.HasValue)
		{
			if (!(await scope.CanAccessStoreAsync(dto.StoreId.Value)))
			{
				return StatusCode(403, ApiResponse.Fail("Không có quyền."));
			}
			q = q.Where((Attendance a) => a.StoreId == dto.StoreId.Value);
		}
		else
		{
			List<int> ids = await scope.GetManagedStoreIdsAsync();
			if (ids != null)
			{
				if (ids.Count == 0)
				{
					return Ok(ApiResponse<object>.Ok(new
					{
						confirmed = 0
					}, "Không có ca chờ duyệt."));
				}
				q = q.Where((Attendance a) => ids.Contains(a.StoreId));
			}
		}
		List<Attendance> pending = await q.ToListAsync();
		int confirmed = 0;
		foreach (Attendance att in pending)
		{
			if (await scope.CanAccessStoreAsync(att.StoreId) && (await ApplyManagerConfirmAsync(att, new ManagerConfirmAttendanceDto
			{
				Note = dto.Note
			}, trackEdit: false)).Item1)
			{
				confirmed++;
			}
		}
		return Ok(ApiResponse<object>.Ok(new
		{
			confirmed = confirmed,
			total = pending.Count
		}, (confirmed > 0) ? $"Đã xác nhận {confirmed} ca." : "Không có ca chờ duyệt."));
	}

	[HttpPost("mark-absent-shift/{shiftRegistrationId:int}")]
	[Authorize(Roles = "Manager")]
	public async Task<IActionResult> MarkAbsentFromShift(int shiftRegistrationId, [FromBody] MarkAbsentDto? dto)
	{
		ShiftRegistration reg = await _db.ShiftRegistrations.Include((ShiftRegistration r) => r.Employee).Include((ShiftRegistration r) => r.Store).FirstOrDefaultAsync((ShiftRegistration r) => r.Id == shiftRegistrationId);
		if (reg == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy ca."));
		}
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		if (!(await userStoreScope.CanAccessStoreAsync(reg.StoreId)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền."));
		}
		if (await AttendanceLookup.HasAttendanceForRegistrationAsync(_db, reg))
		{
			return BadRequest(ApiResponse.Fail("Đã có bản ghi chấm công cho khối ca này."));
		}
		Attendance attendance = new Attendance
		{
			EmployeeId = reg.EmployeeId,
			StoreId = reg.StoreId,
			WorkDate = reg.WorkDate,
			ShiftRegistrationId = reg.Id,
			CheckIn = new TimeOnly(0, 0),
			CheckOut = new TimeOnly(0, 1),
			Status = "Absent",
			ReviewStatus = "Confirmed",
			Note = (dto?.Note ?? "QL xác nhận vắng cuối ngày"),
			CreatedBy = CurrentUserId
		};
		_db.Attendances.Add(attendance);
		await _db.SaveChangesAsync();
		await _db.Entry(attendance).Reference((Attendance a) => a.Employee).LoadAsync();
		await _db.Entry(attendance).Reference((Attendance a) => a.Store).LoadAsync();
		return Ok(ApiResponse<AttendanceDto>.Ok(await MapDtoAsync(attendance), "Đã ghi vắng."));
	}

	[HttpPost("manager-record-shift")]
	[Authorize(Roles = "Manager")]
	public async Task<IActionResult> ManagerRecordShift([FromBody] ManagerRecordShiftDto dto)
	{
		ShiftRegistration reg = await _db.ShiftRegistrations.Include((ShiftRegistration r) => r.Employee).Include((ShiftRegistration r) => r.Store).FirstOrDefaultAsync((ShiftRegistration r) => r.Id == dto.ShiftRegistrationId);
		if (reg == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy ca."));
		}
		if (reg.Status != "Approved")
		{
			return BadRequest(ApiResponse.Fail("Chỉ chấm hộ cho ca đã duyệt."));
		}
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		if (!(await userStoreScope.CanAccessStoreAsync(reg.StoreId)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền."));
		}
		if (reg.WorkDate > DateOnly.FromDateTime(DateTime.Today))
		{
			return BadRequest(ApiResponse.Fail("Không thể chấm công cho ngày tương lai."));
		}
		if (!TimeOnly.TryParse(dto.CheckIn, out var actualIn) || !TimeOnly.TryParse(dto.CheckOut, out var actualOut))
		{
			return BadRequest(ApiResponse.Fail("Giờ không hợp lệ (HH:mm)."));
		}
		if (actualOut <= actualIn)
		{
			return BadRequest(ApiResponse.Fail("Giờ ra phải sau giờ vào."));
		}
		List<ShiftBlockMerge.Block> blocks = ShiftBlockMerge.MergeAdjacent(await (from r in _db.ShiftRegistrations.AsNoTracking()
			where r.EmployeeId == reg.EmployeeId && r.StoreId == reg.StoreId && r.WorkDate == reg.WorkDate && r.Status == "Approved"
			orderby r.StartTime
			select r).ToListAsync());
		ShiftBlockMerge.Block block = ShiftBlockMerge.FindBlockContaining(blocks, reg.Id);
		if (block == null)
		{
			return BadRequest(ApiResponse.Fail("Không tìm thấy khối ca."));
		}
		if (await AttendanceLookup.HasAttendanceForBlockAsync(_db, reg.EmployeeId, reg.WorkDate, block))
		{
			return BadRequest(ApiResponse.Fail("Đã có bản ghi chấm công cho khối ca này."));
		}
		(TimeOnly CheckIn, TimeOnly CheckOut) tuple = AttendanceRules.ResolveFinalTimes(block.StartTime, block.EndTime, actualIn, actualOut);
		TimeOnly item = tuple.CheckIn;
		TimeOnly item2 = tuple.CheckOut;
		decimal standardHours = AttendanceRules.CalcWorkedHours(block.StartTime, block.EndTime);
		Attendance attendance = new Attendance
		{
			EmployeeId = reg.EmployeeId,
			StoreId = reg.StoreId,
			WorkDate = reg.WorkDate,
			ShiftRegistrationId = block.FirstRegistrationId,
			ActualCheckIn = actualIn,
			ActualCheckOut = actualOut,
			Note = (string.IsNullOrWhiteSpace(dto.Note) ? "QL chấm hộ (NV quên bấm)" : dto.Note),
			CreatedBy = CurrentUserId
		};
		AttendanceRules.ApplyWorkedTimes(attendance, item, item2, standardHours);
		attendance.ReviewStatus = "Confirmed";
		_db.Attendances.Add(attendance);
		await _db.SaveChangesAsync();
		await _db.Entry(attendance).Reference((Attendance a) => a.Employee).LoadAsync();
		await _db.Entry(attendance).Reference((Attendance a) => a.Store).LoadAsync();
		return Ok(ApiResponse<AttendanceDto>.Ok(await MapDtoAsync(attendance), "Đã chấm hộ và xác nhận giờ."));
	}

	private async Task<IActionResult> GetMyDayInternal(string? workDate)
	{
		if (!EmployeeId.HasValue)
		{
			return Ok(ApiResponse<object>.Ok(null));
		}
		DateOnly result;
		DateOnly day = (DateOnly.TryParse(workDate, out result) ? result : DateOnly.FromDateTime(DateTime.Now));
		List<ShiftBlockMerge.Block> blocks = ShiftBlockMerge.MergeAdjacent(await (from r in _db.ShiftRegistrations.Include((ShiftRegistration r) => r.Store)
			where r.EmployeeId == EmployeeId.Value && r.WorkDate == day && r.Status == "Approved"
			orderby r.StartTime
			select r).ToListAsync());
		List<Attendance> list = await (from a in _db.Attendances.Include((Attendance a) => a.Employee).Include((Attendance a) => a.Store)
			where a.EmployeeId == EmployeeId.Value && a.WorkDate == day
			orderby a.Id descending
			select a).ToListAsync();
		List<AttendanceDto> attendanceDtos = new List<AttendanceDto>();
		foreach (Attendance item in list)
		{
			List<AttendanceDto> list2 = attendanceDtos;
			list2.Add(await MapDtoAsync(item));
		}
		AttendanceDto attendanceDto = attendanceDtos.FirstOrDefault((AttendanceDto a) => a.ReviewStatus == "Open");
		return Ok(ApiResponse<object>.Ok(new
		{
			workDate = day.ToString("yyyy-MM-dd"),
			shifts = blocks.Select((ShiftBlockMerge.Block b) => new
			{
				id = b.FirstRegistrationId,
				registrationIds = b.RegistrationIds,
				storeId = b.StoreId,
				storeName = b.StoreName,
				workDate = b.WorkDate.ToString("yyyy-MM-dd"),
				startTime = b.StartTime.ToString("HH:mm"),
				endTime = b.EndTime.ToString("HH:mm"),
				shiftTime = $"{b.StartTime:HH:mm}–{b.EndTime:HH:mm}"
			}),
			attendances = attendanceDtos,
			attendance = (attendanceDto ?? attendanceDtos.FirstOrDefault())
		}));
	}

	[HttpGet("pending-review")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> GetPendingReview([FromQuery] int? storeId, [FromQuery] string? workDate)
	{
		UserStoreScope scope = new UserStoreScope(_db, base.User);
		List<int> managedStoreIds = await scope.GetManagedStoreIdsAsync();
		if (managedStoreIds != null && managedStoreIds.Count == 0)
		{
			return Ok(ApiResponse<List<AttendanceDto>>.Ok(new List<AttendanceDto>()));
		}
		IQueryable<Attendance> q = from a in _db.Attendances.Include((Attendance a) => a.Employee).Include((Attendance a) => a.Store)
			where a.ReviewStatus == "PendingReview"
			select a;
		if (Role == "Manager")
		{
			q = q.Where((Attendance a) => a.Employee != null && a.Employee.IsActive);
		}
		if (managedStoreIds != null)
		{
			q = q.Where((Attendance a) => managedStoreIds.Contains(a.StoreId));
		}
		if (storeId.HasValue)
		{
			if (!(await scope.IsStoreFilterAllowedAsync(storeId)))
			{
				return StatusCode(403, ApiResponse.Fail("Không có quyền xem cửa hàng này."));
			}
			q = q.Where((Attendance a) => a.StoreId == ((int?)storeId).Value);
		}
		if (DateOnly.TryParse(workDate, out var wd))
		{
			q = q.Where((Attendance a) => a.WorkDate == wd);
		}
		List<Attendance> list = await (from a in q
			orderby a.WorkDate, a.StoreId
			select a).ToListAsync();
		List<AttendanceDto> dtos = new List<AttendanceDto>();
		foreach (Attendance item in list)
		{
			List<AttendanceDto> list2 = dtos;
			list2.Add(await MapDtoAsync(item));
		}
		return Ok(ApiResponse<List<AttendanceDto>>.Ok(dtos));
	}

	[HttpGet("today-open")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> GetTodayOpen([FromQuery] int? storeId, [FromQuery] int? employeeId)
	{
		if (!employeeId.HasValue)
		{
			return Ok(ApiResponse<AttendanceDto>.Ok(null));
		}
		DateOnly today = DateOnly.FromDateTime(DateTime.Now);
		IQueryable<Attendance> source = from a in _db.Attendances.Include((Attendance a) => a.Employee).Include((Attendance a) => a.Store)
			where a.EmployeeId == ((int?)employeeId).Value && a.WorkDate == today && a.CheckOut == null && a.Status == "Worked"
			select a;
		if (storeId.HasValue)
		{
			source = source.Where((Attendance a) => a.StoreId == ((int?)storeId).Value);
		}
		Attendance attendance = await source.OrderByDescending((Attendance a) => a.Id).FirstOrDefaultAsync();
		if (attendance == null)
		{
			return Ok(ApiResponse<AttendanceDto>.Ok(null));
		}
		return Ok(ApiResponse<AttendanceDto>.Ok(await MapDtoAsync(attendance)));
	}

	[HttpGet("work-context")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> GetWorkContext([FromQuery] int employeeId, [FromQuery] int storeId, [FromQuery] string workDate)
	{
		if (!DateOnly.TryParse(workDate, out var result))
		{
			return BadRequest(ApiResponse.Fail("workDate không hợp lệ."));
		}
		try
		{
			var (standardHours, overtimeRateMultiplier, text) = await AttendanceRules.GetWorkContextAsync(_db, employeeId, storeId, result);
			return Ok(ApiResponse<object>.Ok(new
			{
				standardHours = standardHours,
				overtimeRateMultiplier = overtimeRateMultiplier,
				shiftName = text,
				source = ((text != null) ? "shift_registration" : "store_settings")
			}));
		}
		catch (InvalidOperationException ex)
		{
			return BadRequest(ApiResponse.Fail(ex.Message));
		}
	}

	[HttpGet("summary")]
	[Authorize(Roles = "Admin,Manager")]
	public async Task<IActionResult> GetSummary([FromQuery] int? storeId, [FromQuery] int month, [FromQuery] int year)
	{
		UserStoreScope scope = new UserStoreScope(_db, base.User);
		List<int> managedStoreIds = await scope.GetManagedStoreIdsAsync();
		if (managedStoreIds != null && managedStoreIds.Count == 0)
		{
			return Ok(ApiResponse<List<AttendanceSummaryDto>>.Ok(new List<AttendanceSummaryDto>()));
		}
		bool hasValue = storeId.HasValue;
		bool flag = hasValue;
		if (flag)
		{
			flag = !(await scope.IsStoreFilterAllowedAsync(storeId));
		}
		if (flag)
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền xem cửa hàng này."));
		}
		DateOnly dateFrom = new DateOnly(year, month, 1);
		DateOnly dateTo = dateFrom.AddMonths(1).AddDays(-1);
		IQueryable<Attendance> source = from a in _db.Attendances.Include((Attendance a) => a.Employee)
			where a.WorkDate >= dateFrom && a.WorkDate <= dateTo && a.Status == "Worked" && a.ReviewStatus == "Confirmed" && a.CheckOut != null
			select a;
		if (managedStoreIds != null)
		{
			source = source.Where((Attendance a) => managedStoreIds.Contains(a.StoreId));
		}
		if (storeId.HasValue)
		{
			source = source.Where((Attendance a) => a.StoreId == ((int?)storeId).Value);
		}
		List<AttendanceSummaryDto> data = (from a in await source.ToListAsync()
			group a by a.EmployeeId into g
			select new AttendanceSummaryDto
			{
				EmployeeId = g.Key,
				EmployeeName = (g.First().Employee?.FullName ?? ""),
				EmployeeCode = (g.First().Employee?.EmployeeCode ?? ""),
				WorkedDays = g.Select((Attendance a) => a.WorkDate).Distinct().Count(),
				WorkedHours = g.Sum((Attendance a) => a.WorkedHours),
				OvertimeHours = g.Sum((Attendance a) => a.OvertimeHours)
			} into s
			orderby s.EmployeeName
			select s).ToList();
		return Ok(ApiResponse<List<AttendanceSummaryDto>>.Ok(data));
	}

	[HttpPost("confirm-shift")]
	[Authorize(Roles = "Manager")]
	public async Task<IActionResult> ConfirmShift([FromBody] ConfirmShiftAttendanceDto dto)
	{
		ShiftRegistration reg = await _db.ShiftRegistrations.Include((ShiftRegistration r) => r.Employee).Include((ShiftRegistration r) => r.Store).FirstOrDefaultAsync((ShiftRegistration r) => r.Id == dto.ShiftRegistrationId);
		if (reg == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy đăng ký ca."));
		}
		if (reg.Status != "Approved")
		{
			return BadRequest(ApiResponse.Fail("Chỉ xác nhận chấm công cho ca đã duyệt."));
		}
		UserStoreScope scope = new UserStoreScope(_db, base.User);
		bool flag = !(await scope.CanAccessStoreAsync(reg.StoreId));
		bool flag2 = flag;
		if (!flag2)
		{
			flag2 = !(await scope.CanAccessEmployeeAsync(reg.EmployeeId));
		}
		if (flag2)
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền thao tác cửa hàng/nhân viên này."));
		}
		if (reg.WorkDate > DateOnly.FromDateTime(DateTime.Today))
		{
			return BadRequest(ApiResponse.Fail("Không thể chấm công cho ngày tương lai."));
		}
		if (await AttendanceLookup.HasAttendanceForRegistrationAsync(_db, reg))
		{
			return BadRequest(ApiResponse.Fail("Đã chấm công cho khối ca này."));
		}
		Attendance attendance;
		if (dto.Worked)
		{
			decimal standardHours = await AttendanceRules.GetStandardHoursAsync(_db, reg.EmployeeId, reg.StoreId, reg.WorkDate, reg.Id);
			attendance = new Attendance
			{
				EmployeeId = reg.EmployeeId,
				StoreId = reg.StoreId,
				WorkDate = reg.WorkDate,
				CreatedBy = CurrentUserId
			};
			AttendanceRules.ApplyWorkedTimes(attendance, reg.StartTime, reg.EndTime, standardHours);
			attendance.ShiftRegistrationId = reg.Id;
			attendance.ReviewStatus = "Confirmed";
		}
		else
		{
			attendance = new Attendance
			{
				EmployeeId = reg.EmployeeId,
				StoreId = reg.StoreId,
				WorkDate = reg.WorkDate,
				ShiftRegistrationId = reg.Id,
				CheckIn = new TimeOnly(0, 0),
				CheckOut = new TimeOnly(0, 1),
				Status = "Absent",
				OvertimeHours = 0m,
				CreatedBy = CurrentUserId
			};
		}
		_db.Attendances.Add(attendance);
		await _db.SaveChangesAsync();
		await _db.Entry(attendance).Reference((Attendance a) => a.Employee).LoadAsync();
		await _db.Entry(attendance).Reference((Attendance a) => a.Store).LoadAsync();
		return Ok(ApiResponse<AttendanceDto>.Ok(message: dto.Worked ? "Đã xác nhận đi làm." : "Đã xác nhận không đi làm.", data: await MapDtoAsync(attendance)));
	}

	[HttpPost("check-in")]
	[Authorize(Roles = "Employee,Manager")]
	public async Task<IActionResult> CheckIn([FromBody] CheckInDto dto)
	{
		try
		{
			return await CheckInInternalAsync(dto);
		}
		catch (DbUpdateException ex)
		{
			return BadRequest(ApiResponse.Fail(MapAttendanceDbError(ex)));
		}
	}

	private async Task<IActionResult> CheckInInternalAsync(CheckInDto dto)
	{
		if (!EmployeeId.HasValue)
		{
			return StatusCode(403, ApiResponse.Fail("Tài khoản chưa liên kết nhân viên."));
		}
		DateOnly result;
		DateOnly workDate = (DateOnly.TryParse(dto.WorkDate, out result) ? result : DateOnly.FromDateTime(DateTime.Now));
		if (workDate > DateOnly.FromDateTime(DateTime.Today))
		{
			return BadRequest(ApiResponse.Fail("Không thể chấm công cho ngày tương lai."));
		}
		List<ShiftRegistration> list = await (from r in _db.ShiftRegistrations.Include((ShiftRegistration r) => r.Store)
			where r.EmployeeId == EmployeeId.Value && r.WorkDate == workDate && r.Status == "Approved"
			orderby r.StartTime
			select r).ToListAsync();
		if (list.Count == 0)
		{
			return BadRequest(ApiResponse.Fail("Không có ca đã duyệt hôm nay. Đăng ký ca và chờ quản lý duyệt trước."));
		}
		List<ShiftBlockMerge.Block> list2 = ShiftBlockMerge.MergeAdjacent(list);
		if (dto.StoreId.HasValue)
		{
			list2 = list2.Where((ShiftBlockMerge.Block b) => b.StoreId == dto.StoreId.Value).ToList();
		}
		if (list2.Count == 0)
		{
			return BadRequest(ApiResponse.Fail("Không có ca đã duyệt tại cửa hàng này."));
		}
		if (list2.Count > 1 && !dto.ShiftRegistrationId.HasValue)
		{
			return BadRequest(ApiResponse.Fail("Bạn có nhiều khối ca hôm nay — chọn ca để bắt đầu."));
		}
		ShiftBlockMerge.Block block = (dto.ShiftRegistrationId.HasValue ? ShiftBlockMerge.FindBlockContaining(list2, dto.ShiftRegistrationId.Value) : list2[0]);
		if (block == null)
		{
			return BadRequest(ApiResponse.Fail("Không tìm thấy ca tương ứng."));
		}
		if (await _db.Attendances.AnyAsync((Attendance a) => a.EmployeeId == EmployeeId.Value && a.WorkDate == workDate && a.ReviewStatus == "Open"))
		{
			return BadRequest(ApiResponse.Fail("Bạn đang trong ca — bấm Kết thúc trước khi vào ca mới."));
		}
		if (await AttendanceLookup.HasAttendanceForBlockAsync(_db, EmployeeId.Value, workDate, block))
		{
			return BadRequest(ApiResponse.Fail("Đã chấm công cho khối ca này hôm nay."));
		}
		TimeOnly value = TimeOnly.FromDateTime(DateTime.Now);
		Attendance attendance = new Attendance
		{
			EmployeeId = EmployeeId.Value,
			StoreId = block.StoreId,
			WorkDate = workDate,
			ShiftRegistrationId = block.FirstRegistrationId,
			ActualCheckIn = value,
			CheckIn = block.StartTime,
			CheckOut = null,
			Status = "Worked",
			ReviewStatus = "Open",
			CreatedBy = CurrentUserId
		};
		_db.Attendances.Add(attendance);
		await _db.SaveChangesAsync();
		await _db.Entry(attendance).Reference((Attendance a) => a.Employee).LoadAsync();
		await _db.Entry(attendance).Reference((Attendance a) => a.Store).LoadAsync();
		return Ok(ApiResponse<AttendanceDto>.Ok(await MapDtoAsync(attendance), "Đã bắt đầu ca."));
	}

	private static string MapAttendanceDbError(DbUpdateException ex)
	{
		string text = ex.InnerException?.Message ?? ex.Message;
		if (text.Contains("UQ_Attendances_Employee_ShiftReg", StringComparison.OrdinalIgnoreCase) || text.Contains("UQ_Attendances", StringComparison.OrdinalIgnoreCase) || (text.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase) && text.Contains("Attendances", StringComparison.OrdinalIgnoreCase)))
		{
			return "Đã chấm công cho khối ca này. Chọn ca khác hoặc liên hệ QL nếu cần sửa.";
		}
		if (text.Length <= 280)
		{
			return text;
		}
		return text.Substring(0, 280);
	}

	[HttpPost("{id:int}/check-out")]
	[Authorize]
	public async Task<IActionResult> CheckOut(int id)
	{
		Attendance a = await _db.Attendances.Include((Attendance x) => x.Employee).Include((Attendance x) => x.Store).FirstOrDefaultAsync((Attendance x) => x.Id == id);
		if (a == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy bản ghi."));
		}
		if (a.ReviewStatus != "Open")
		{
			return BadRequest(ApiResponse.Fail("Ca này không ở trạng thái đang làm."));
		}
		bool isSelf = EmployeeId.HasValue && EmployeeId.Value == a.EmployeeId;
		if (Role == "Employee" || (Role == "Manager" && isSelf))
		{
			if (!isSelf)
			{
				return StatusCode(403, ApiResponse.Fail("Chỉ được kết thúc ca của chính mình."));
			}
		}
		else
		{
			UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
			if (!(await userStoreScope.CanAccessStoreAsync(a.StoreId)))
			{
				return StatusCode(403, ApiResponse.Fail("Không có quyền chấm công tại cửa hàng này."));
			}
		}
		TimeOnly timeOnly = TimeOnly.FromDateTime(DateTime.Now);
		if (a.ActualCheckIn.HasValue && timeOnly <= a.ActualCheckIn.Value)
		{
			return BadRequest(ApiResponse.Fail("Giờ ra phải sau giờ vào."));
		}
		a.ActualCheckOut = timeOnly;
		a.ReviewStatus = "PendingReview";
		a.UpdatedBy = CurrentUserId;
		a.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync();
		if (Role == "Manager" && isSelf)
		{
			var (flag, text) = await ApplyManagerConfirmAsync(a, new ManagerConfirmAttendanceDto(), trackEdit: false);
			if (!flag)
			{
				return BadRequest(ApiResponse.Fail(text ?? "Không thể tự xác nhận giờ."));
			}
			return Ok(ApiResponse<AttendanceDto>.Ok(await MapDtoAsync(a), "Đã kết thúc ca và tự xác nhận giờ."));
		}
		return Ok(ApiResponse<AttendanceDto>.Ok(message: (Role == "Employee") ? "Đã kết thúc ca — chờ quản lý xác nhận giờ." : "Đã chấm ra ca.", data: await MapDtoAsync(a)));
	}

	[HttpPost("{id:int}/manager-set-times")]
	[Authorize(Roles = "Manager")]
	public async Task<IActionResult> ManagerSetTimes(int id, [FromBody] ManagerConfirmAttendanceDto dto)
	{
		Attendance a = await _db.Attendances.Include((Attendance x) => x.Employee).Include((Attendance x) => x.Store).FirstOrDefaultAsync((Attendance x) => x.Id == id);
		if (a == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy bản ghi."));
		}
		if (a.ReviewStatus != "Open" && a.ReviewStatus != "PendingReview")
		{
			return BadRequest(ApiResponse.Fail("Chỉ sửa bản ghi đang ca hoặc chờ QL xác nhận."));
		}
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		if (!(await userStoreScope.CanAccessStoreAsync(a.StoreId)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền."));
		}
		if (dto.Absent)
		{
			a.Status = "Absent";
			a.CheckIn = new TimeOnly(0, 0);
			a.CheckOut = new TimeOnly(0, 1);
			a.OvertimeHours = 0m;
			a.ReviewStatus = "Confirmed";
			a.Note = dto.Note;
			a.UpdatedBy = CurrentUserId;
			a.UpdatedAt = DateTime.UtcNow;
			await _db.SaveChangesAsync();
			return Ok(ApiResponse<AttendanceDto>.Ok(await MapDtoAsync(a), "Đã xác nhận không đi làm."));
		}
		if (!string.IsNullOrWhiteSpace(dto.CheckIn) && TimeOnly.TryParse(dto.CheckIn, out var result))
		{
			a.ActualCheckIn = result;
		}
		if (!string.IsNullOrWhiteSpace(dto.CheckOut) && TimeOnly.TryParse(dto.CheckOut, out var result2))
		{
			a.ActualCheckOut = result2;
		}
		if (!a.ActualCheckIn.HasValue || !a.ActualCheckOut.HasValue)
		{
			return BadRequest(ApiResponse.Fail("Cần nhập đủ giờ vào và giờ ra."));
		}
		if (a.ActualCheckOut <= a.ActualCheckIn)
		{
			return BadRequest(ApiResponse.Fail("Giờ ra phải sau giờ vào."));
		}
		if (a.ReviewStatus == "Open")
		{
			a.ReviewStatus = "PendingReview";
		}
		var (flag, text) = await ApplyManagerConfirmAsync(a, dto, trackEdit: true);
		if (!flag)
		{
			return BadRequest(ApiResponse.Fail(text ?? "Không thể lưu giờ."));
		}
		return Ok(ApiResponse<AttendanceDto>.Ok(await MapDtoAsync(a), "Đã lưu giờ chấm công."));
	}

	[HttpPost("{id:int}/manager-confirm")]
	[Authorize(Roles = "Manager")]
	public async Task<IActionResult> ManagerConfirm(int id, [FromBody] ManagerConfirmAttendanceDto dto)
	{
		Attendance a = await _db.Attendances.Include((Attendance x) => x.Employee).Include((Attendance x) => x.Store).FirstOrDefaultAsync((Attendance x) => x.Id == id);
		if (a == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy bản ghi."));
		}
		if (a.ReviewStatus != "PendingReview")
		{
			return BadRequest(ApiResponse.Fail("Chỉ duyệt bản ghi đã kết thúc ca (chờ QL)."));
		}
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		bool isSelf = EmployeeId.HasValue && a.EmployeeId == EmployeeId.Value;
		bool flag = !isSelf;
		bool flag2 = flag;
		if (flag2)
		{
			flag2 = !(await userStoreScope.CanAccessStoreAsync(a.StoreId));
		}
		if (flag2)
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền duyệt cửa hàng này."));
		}
		if (dto.Absent)
		{
			a.Status = "Absent";
			a.CheckIn = new TimeOnly(0, 0);
			a.CheckOut = new TimeOnly(0, 1);
			a.OvertimeHours = 0m;
			a.ReviewStatus = "Confirmed";
			a.Note = dto.Note;
			a.UpdatedBy = CurrentUserId;
			a.UpdatedAt = DateTime.UtcNow;
			await _db.SaveChangesAsync();
			return Ok(ApiResponse<AttendanceDto>.Ok(await MapDtoAsync(a), "Đã xác nhận không đi làm."));
		}
		var (flag3, text) = await ApplyManagerConfirmAsync(a, dto, !isSelf);
		if (!flag3)
		{
			return BadRequest(ApiResponse.Fail(text ?? "Không thể duyệt."));
		}
		return Ok(ApiResponse<AttendanceDto>.Ok(await MapDtoAsync(a), isSelf ? "Đã xác nhận giờ chấm công (bản thân)." : "Đã lưu giờ chấm công."));
	}

	private async Task<(bool Ok, string? Error)> ApplyManagerConfirmAsync(Attendance a, ManagerConfirmAttendanceDto dto, bool trackEdit)
	{
		if (a.ReviewStatus != "PendingReview")
		{
			return (Ok: false, Error: "Chỉ duyệt bản ghi đã kết thúc ca (chờ QL).");
		}
		if (!a.ActualCheckIn.HasValue || !a.ActualCheckOut.HasValue)
		{
			return (Ok: false, Error: "Thiếu giờ chấm thực tế.");
		}
		(TimeOnly, TimeOnly) tuple = await GetShiftTimesAsync(a);
		TimeOnly item = tuple.Item1;
		TimeOnly item2 = tuple.Item2;
		(TimeOnly CheckIn, TimeOnly CheckOut) tuple2 = AttendanceRules.ResolveFinalTimes(item, item2, a.ActualCheckIn.Value, a.ActualCheckOut.Value);
		TimeOnly item3 = tuple2.CheckIn;
		TimeOnly item4 = tuple2.CheckOut;
		bool flag = false;
		TimeOnly result;
		TimeOnly result2;
		if (!string.IsNullOrWhiteSpace(dto.CheckIn) && !string.IsNullOrWhiteSpace(dto.CheckOut))
		{
			if (!TimeOnly.TryParse(dto.CheckIn, out result) || !TimeOnly.TryParse(dto.CheckOut, out result2))
			{
				return (Ok: false, Error: "Giờ không hợp lệ (HH:mm).");
			}
			if (result2 <= result)
			{
				return (Ok: false, Error: "Giờ ra phải sau giờ vào.");
			}
			flag = result != item3 || result2 != item4;
		}
		else
		{
			result = item3;
			result2 = item4;
		}
		decimal standardHours = AttendanceRules.CalcWorkedHours(item, item2);
		AttendanceRules.ApplyWorkedTimes(a, result, result2, standardHours);
		a.ReviewStatus = "Confirmed";
		if (!string.IsNullOrWhiteSpace(dto.Note))
		{
			a.Note = dto.Note;
		}
		if (trackEdit && flag)
		{
			a.EditCount++;
			if (a.EditCount >= 2)
			{
				a.FlaggedForReview = true;
			}
		}
		a.UpdatedBy = CurrentUserId;
		a.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync();
		return (Ok: true, Error: null);
	}

	[HttpPost]
	[Authorize(Roles = "Manager")]
	public async Task<IActionResult> Create([FromBody] CreateAttendanceDto dto)
	{
		UserStoreScope scope = new UserStoreScope(_db, base.User);
		bool flag = !(await scope.CanAccessStoreAsync(dto.StoreId));
		bool flag2 = flag;
		if (!flag2)
		{
			flag2 = !(await scope.CanAccessEmployeeAsync(dto.EmployeeId));
		}
		if (flag2)
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền thao tác cửa hàng/nhân viên này."));
		}
		if (!DateOnly.TryParse(dto.WorkDate, out var workDate))
		{
			return BadRequest(ApiResponse.Fail("WorkDate không hợp lệ."));
		}
		if (workDate > DateOnly.FromDateTime(DateTime.Today))
		{
			return BadRequest(ApiResponse.Fail("Không thể chấm công cho ngày tương lai."));
		}
		if (!TimeOnly.TryParse(dto.CheckIn, out var checkIn) || !TimeOnly.TryParse(dto.CheckOut, out var checkOut))
		{
			return BadRequest(ApiResponse.Fail("Giờ vào/ra không hợp lệ (HH:mm)."));
		}
		if (checkOut <= checkIn)
		{
			return BadRequest(ApiResponse.Fail("Giờ ra phải sau giờ vào."));
		}
		if (await _db.Attendances.AnyAsync((Attendance a) => a.EmployeeId == dto.EmployeeId && a.StoreId == dto.StoreId && a.WorkDate == workDate))
		{
			return BadRequest(ApiResponse.Fail("Đã có bản ghi chấm công cho nhân viên này ngày này."));
		}
		decimal standardHours = await AttendanceRules.GetStandardHoursAsync(_db, dto.EmployeeId, dto.StoreId, workDate);
		Attendance attendance = new Attendance
		{
			EmployeeId = dto.EmployeeId,
			StoreId = dto.StoreId,
			WorkDate = workDate,
			Note = dto.Note,
			CreatedBy = CurrentUserId
		};
		AttendanceRules.ApplyWorkedTimes(attendance, checkIn, checkOut, standardHours);
		attendance.ReviewStatus = "Confirmed";
		_db.Attendances.Add(attendance);
		await _db.SaveChangesAsync();
		await _db.Entry(attendance).Reference((Attendance a) => a.Employee).LoadAsync();
		await _db.Entry(attendance).Reference((Attendance a) => a.Store).LoadAsync();
		return Ok(ApiResponse<AttendanceDto>.Ok(await MapDtoAsync(attendance), "Chấm công thành công."));
	}

	[HttpPost("mark-absent")]
	[Authorize(Roles = "Manager")]
	public async Task<IActionResult> MarkAbsent([FromBody] MarkAbsentDto dto)
	{
		UserStoreScope scope = new UserStoreScope(_db, base.User);
		bool flag = !(await scope.CanAccessStoreAsync(dto.StoreId));
		bool flag2 = flag;
		if (!flag2)
		{
			flag2 = !(await scope.CanAccessEmployeeAsync(dto.EmployeeId));
		}
		if (flag2)
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền thao tác cửa hàng/nhân viên này."));
		}
		if (!DateOnly.TryParse(dto.WorkDate, out var workDate))
		{
			return BadRequest(ApiResponse.Fail("WorkDate không hợp lệ."));
		}
		if (await _db.Attendances.AnyAsync((Attendance a) => a.EmployeeId == dto.EmployeeId && a.StoreId == dto.StoreId && a.WorkDate == workDate))
		{
			return BadRequest(ApiResponse.Fail("Đã có bản ghi cho ngày này."));
		}
		Attendance attendance = new Attendance
		{
			EmployeeId = dto.EmployeeId,
			StoreId = dto.StoreId,
			WorkDate = workDate,
			CheckIn = new TimeOnly(0, 0),
			CheckOut = new TimeOnly(0, 1),
			Status = "Absent",
			OvertimeHours = 0m,
			Note = dto.Note,
			CreatedBy = CurrentUserId
		};
		_db.Attendances.Add(attendance);
		await _db.SaveChangesAsync();
		await _db.Entry(attendance).Reference((Attendance a) => a.Employee).LoadAsync();
		await _db.Entry(attendance).Reference((Attendance a) => a.Store).LoadAsync();
		return Ok(ApiResponse<AttendanceDto>.Ok(await MapDtoAsync(attendance), "Đã ghi nhận không đi làm."));
	}

	[HttpPut("{id:int}")]
	[Authorize(Roles = "Manager")]
	public async Task<IActionResult> Update(int id, [FromBody] UpdateAttendanceDto dto)
	{
		Attendance a = await _db.Attendances.FindAsync(id);
		if (a == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy bản ghi."));
		}
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		if (!(await userStoreScope.CanAccessStoreAsync(a.StoreId)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền sửa bản ghi này."));
		}
		if (a.Status == "Absent")
		{
			return BadRequest(ApiResponse.Fail("Bản ghi vắng không chỉnh giờ. Xóa và tạo mới nếu cần."));
		}
		if (!TimeOnly.TryParse(dto.CheckIn, out var checkIn) || !TimeOnly.TryParse(dto.CheckOut, out var checkOut))
		{
			return BadRequest(ApiResponse.Fail("Giờ không hợp lệ."));
		}
		if (checkOut <= checkIn)
		{
			return BadRequest(ApiResponse.Fail("Giờ ra phải sau giờ vào."));
		}
		(TimeOnly, TimeOnly) tuple = await GetShiftTimesAsync(a);
		TimeOnly item = tuple.Item1;
		TimeOnly item2 = tuple.Item2;
		decimal standardHours = AttendanceRules.CalcWorkedHours(item, item2);
		AttendanceRules.ApplyWorkedTimes(a, checkIn, checkOut, standardHours);
		a.ReviewStatus = "Confirmed";
		a.EditCount++;
		if (a.EditCount >= 2)
		{
			a.FlaggedForReview = true;
		}
		a.Note = dto.Note;
		a.UpdatedBy = CurrentUserId;
		a.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok("Cập nhật thành công."));
	}

	[HttpDelete("{id:int}")]
	[Authorize(Roles = "Manager")]
	public async Task<IActionResult> Delete(int id)
	{
		Attendance a = await _db.Attendances.FindAsync(id);
		if (a == null)
		{
			return NotFound(ApiResponse.Fail("Không tìm thấy bản ghi."));
		}
		UserStoreScope userStoreScope = new UserStoreScope(_db, base.User);
		if (!(await userStoreScope.CanAccessStoreAsync(a.StoreId)))
		{
			return StatusCode(403, ApiResponse.Fail("Không có quyền xóa bản ghi này."));
		}
		_db.Attendances.Remove(a);
		await _db.SaveChangesAsync();
		return Ok(ApiResponse.Ok("Đã xóa bản ghi chấm công."));
	}

	private async Task<(TimeOnly Start, TimeOnly End)> GetShiftTimesAsync(Attendance a)
	{
		List<ShiftRegistration> list = await (from r in _db.ShiftRegistrations.AsNoTracking().Include((ShiftRegistration r) => r.Store)
			where r.EmployeeId == a.EmployeeId && r.StoreId == a.StoreId && r.WorkDate == a.WorkDate && r.Status == "Approved"
			orderby r.StartTime
			select r).ToListAsync();
		if (list.Count > 0)
		{
			List<ShiftBlockMerge.Block> blocks = ShiftBlockMerge.MergeAdjacent(list);
			ShiftBlockMerge.Block block = ShiftBlockMerge.FindBlockForAttendance(blocks, a);
			if (block != null)
			{
				return (Start: block.StartTime, End: block.EndTime);
			}
		}
		decimal num = (await _db.Stores.AsNoTracking().FirstOrDefaultAsync((Store s) => s.Id == a.StoreId))?.StandardWorkHoursPerDay ?? 8m;
		return (Start: new TimeOnly(8, 0), End: new TimeOnly(8, 0).AddHours((double)num));
	}

	private async Task<AttendanceDto> MapDtoAsync(Attendance a)
	{
		decimal standard = default(decimal);
		if (a.Status == "Worked")
		{
			(TimeOnly, TimeOnly) tuple = await GetShiftTimesAsync(a);
			TimeOnly item = tuple.Item1;
			TimeOnly item2 = tuple.Item2;
			standard = AttendanceRules.CalcWorkedHours(item, item2);
		}
		string scheduledStart = null;
		string scheduledEnd = null;
		string suggestedIn = null;
		string suggestedOut = null;
		if (a.Status == "Worked" && a.ActualCheckIn.HasValue && (a.ReviewStatus == "Open" || a.ReviewStatus == "PendingReview"))
		{
			(TimeOnly, TimeOnly) tuple2 = await GetShiftTimesAsync(a);
			TimeOnly item3 = tuple2.Item1;
			TimeOnly item4 = tuple2.Item2;
			scheduledStart = item3.ToString("HH:mm");
			scheduledEnd = item4.ToString("HH:mm");
			if (a.ActualCheckOut.HasValue)
			{
				(TimeOnly CheckIn, TimeOnly CheckOut) tuple3 = AttendanceRules.ResolveFinalTimes(item3, item4, a.ActualCheckIn.Value, a.ActualCheckOut.Value);
				TimeOnly item5 = tuple3.CheckIn;
				TimeOnly item6 = tuple3.CheckOut;
				suggestedIn = item5.ToString("HH:mm");
				suggestedOut = item6.ToString("HH:mm");
			}
		}
		return new AttendanceDto
		{
			Id = a.Id,
			EmployeeId = a.EmployeeId,
			EmployeeName = (a.Employee?.FullName ?? ""),
			EmployeeCode = (a.Employee?.EmployeeCode ?? ""),
			StoreId = a.StoreId,
			StoreName = (a.Store?.Name ?? ""),
			WorkDate = a.WorkDate.ToString("yyyy-MM-dd"),
			CheckIn = ((a.ReviewStatus == "Confirmed" || a.CheckOut.HasValue) ? a.CheckIn.ToString("HH:mm") : (suggestedIn ?? a.CheckIn.ToString("HH:mm"))),
			CheckOut = a.CheckOut?.ToString("HH:mm"),
			IsOpen = a.IsOpen,
			WorkedHours = a.WorkedHours,
			OvertimeHours = a.OvertimeHours,
			StandardHours = standard,
			Status = a.Status,
			StatusLabel = AttendanceStatuses.Label(a.Status),
			ReviewStatus = a.ReviewStatus,
			ReviewStatusLabel = AttendanceReviewStatuses.Label(a.ReviewStatus),
			ShiftRegistrationId = a.ShiftRegistrationId,
			ScheduledStart = scheduledStart,
			ScheduledEnd = scheduledEnd,
			ActualCheckIn = a.ActualCheckIn?.ToString("HH:mm"),
			ActualCheckOut = a.ActualCheckOut?.ToString("HH:mm"),
			SuggestedCheckIn = suggestedIn,
			SuggestedCheckOut = suggestedOut,
			EditCount = a.EditCount,
			FlaggedForReview = a.FlaggedForReview,
			Note = a.Note,
			CreatedAt = a.CreatedAt.ToString("yyyy-MM-dd HH:mm")
		};
	}
}
