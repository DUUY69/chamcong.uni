using System;

namespace WorkforceManagement.Api.Data;

public class Holiday
{
	public int Id { get; set; }

	public DateOnly Date { get; set; }

	public string Name { get; set; } = "";

	public decimal Multiplier { get; set; } = 3.0m;

	public bool IsActive { get; set; } = true;

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
