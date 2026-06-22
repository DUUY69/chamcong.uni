using System;
using System.Collections.Generic;
using System.Linq;
using WorkforceManagement.Api.Data;

namespace WorkforceManagement.Api.Services;

public static class ShiftBlockMerge
{
	public sealed class Block
	{
		public int FirstRegistrationId { get; set; }

		public List<int> RegistrationIds { get; } = new List<int>();

		public int StoreId { get; set; }

		public string StoreName { get; set; } = "";

		public DateOnly WorkDate { get; set; }

		public TimeOnly StartTime { get; set; }

		public TimeOnly EndTime { get; set; }
	}

	public static List<Block> MergeAdjacent(IEnumerable<ShiftRegistration> shifts)
	{
		List<ShiftRegistration> list = (from r in shifts
			orderby r.StoreId, r.StartTime
			select r).ToList();
		List<Block> list2 = new List<Block>();
		Block block = null;
		foreach (ShiftRegistration item in list)
		{
			if (block == null || block.StoreId != item.StoreId || block.WorkDate != item.WorkDate || block.EndTime != item.StartTime)
			{
				block = new Block
				{
					FirstRegistrationId = item.Id,
					StoreId = item.StoreId,
					StoreName = (item.Store?.Name ?? ""),
					WorkDate = item.WorkDate,
					StartTime = item.StartTime,
					EndTime = item.EndTime
				};
				block.RegistrationIds.Add(item.Id);
				list2.Add(block);
			}
			else
			{
				block.RegistrationIds.Add(item.Id);
				block.EndTime = item.EndTime;
			}
		}
		return list2;
	}

	public static Block? FindBlockContaining(IEnumerable<Block> blocks, int registrationId)
	{
		return blocks.FirstOrDefault((Block b) => b.RegistrationIds.Contains(registrationId));
	}

	public static Block? FindBlockForAttendance(IEnumerable<Block> blocks, Attendance attendance)
	{
		if (attendance.ShiftRegistrationId.HasValue)
		{
			Block block = FindBlockContaining(blocks, attendance.ShiftRegistrationId.Value);
			if (block != null)
			{
				return block;
			}
		}
		return blocks.FirstOrDefault((Block b) => b.StoreId == attendance.StoreId && b.WorkDate == attendance.WorkDate);
	}
}
