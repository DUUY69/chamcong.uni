namespace WorkforceManagement.Api.Models.Config;

public class SalaryRaiseRuleDto
{
	public int Id { get; set; }

	public int MinTenureMonths { get; set; }

	public decimal MinWorkedHours { get; set; }

	public bool IsActive { get; set; }

	public string? Description { get; set; }

	public string CreatedAt { get; set; } = "";
}
