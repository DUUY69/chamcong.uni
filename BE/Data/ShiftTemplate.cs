using System;

namespace WorkforceManagement.Api.Data;

public class ShiftTemplate
{
	public int Id { get; set; }

	public string Name { get; set; } = "";

	public TimeOnly StartTime { get; set; }

	public TimeOnly EndTime { get; set; }

	public string? ColorHex { get; set; }

	public int SortOrder { get; set; }

	public bool IsActive { get; set; } = true;

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public DateTime? UpdatedAt { get; set; }
}
