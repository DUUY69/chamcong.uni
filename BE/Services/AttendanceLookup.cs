using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;

namespace WorkforceManagement.Api.Services;

public static class AttendanceLookup
{
	public static async Task<bool> HasAttendanceForBlockAsync(AppDbContext db, int employeeId, DateOnly workDate, ShiftBlockMerge.Block block)
	{
		List<int> regIds = block.RegistrationIds;
		return await db.Attendances.AnyAsync((Attendance a) => a.EmployeeId == employeeId && a.WorkDate == workDate && a.ShiftRegistrationId.HasValue && regIds.Contains(a.ShiftRegistrationId.Value));
	}

	public static async Task<bool> HasAttendanceForRegistrationAsync(AppDbContext db, ShiftRegistration reg)
	{
		List<ShiftBlockMerge.Block> blocks = ShiftBlockMerge.MergeAdjacent(await (from r in db.ShiftRegistrations.AsNoTracking()
			where r.EmployeeId == reg.EmployeeId && r.StoreId == reg.StoreId && r.WorkDate == reg.WorkDate && r.Status == "Approved"
			orderby r.StartTime
			select r).ToListAsync());
		ShiftBlockMerge.Block block = ShiftBlockMerge.FindBlockContaining(blocks, reg.Id);
		if (block != null)
		{
			return await HasAttendanceForBlockAsync(db, reg.EmployeeId, reg.WorkDate, block);
		}
		return await db.Attendances.AnyAsync((Attendance a) => a.EmployeeId == reg.EmployeeId && a.WorkDate == reg.WorkDate && a.ShiftRegistrationId == (int?)reg.Id);
	}

	public static Attendance? FindForRegistration(IEnumerable<Attendance> attendances, IEnumerable<ShiftBlockMerge.Block> blocks, ShiftRegistration reg)
	{
		IList<Attendance> source = (attendances as IList<Attendance>) ?? attendances.ToList();
		Attendance attendance = source.FirstOrDefault((Attendance a) => a.ShiftRegistrationId == reg.Id);
		if (attendance != null)
		{
			return attendance;
		}
		ShiftBlockMerge.Block block = ShiftBlockMerge.FindBlockContaining(blocks, reg.Id);
		if (block == null)
		{
			return null;
		}
		return source.FirstOrDefault((Attendance a) => a.EmployeeId == reg.EmployeeId && a.StoreId == reg.StoreId && a.WorkDate == reg.WorkDate && a.ShiftRegistrationId.HasValue && block.RegistrationIds.Contains(a.ShiftRegistrationId.Value));
	}
}
