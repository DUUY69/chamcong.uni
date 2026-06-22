namespace WorkforceManagement.Api.Models.Employee;

public class SaveWorkExperienceDto
{
	public string CompanyName { get; set; } = "";

	public string Position { get; set; } = "";

	public string StartDate { get; set; } = "";

	public string? EndDate { get; set; }

	public string? Description { get; set; }
}
