namespace WorkforceManagement.Api.Models.Config;

public class SaveSalaryRaiseRuleDto
{
	public int? MinTenureMonths { get; set; }

	public decimal? MinWorkedHours { get; set; }

	public string? Description { get; set; }
}
