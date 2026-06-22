using System;

namespace WorkforceManagement.Api.Data;

public class EmployeeWorkExperience
{
	public int Id { get; set; }

	public int EmployeeId { get; set; }

	public string CompanyName { get; set; } = "";

	public string Position { get; set; } = "";

	public DateOnly StartDate { get; set; }

	public DateOnly? EndDate { get; set; }

	public string? Description { get; set; }

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public DateTime? UpdatedAt { get; set; }

	public Employee Employee { get; set; }
}
