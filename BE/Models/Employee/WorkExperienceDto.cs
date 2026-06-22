namespace WorkforceManagement.Api.Models.Employee;

public class WorkExperienceDto
{
	public int Id { get; set; }

	public int EmployeeId { get; set; }

	public string CompanyName { get; set; } = "";

	public string Position { get; set; } = "";

	public string StartDate { get; set; } = "";

	public string? EndDate { get; set; }

	public string? Description { get; set; }

	public string CreatedAt { get; set; } = "";
}
