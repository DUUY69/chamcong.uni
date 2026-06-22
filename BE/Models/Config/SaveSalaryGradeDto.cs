namespace WorkforceManagement.Api.Models.Config;

public class SaveSalaryGradeDto
{
	public string Code { get; set; } = "";

	public string? Label { get; set; }

	public decimal Value { get; set; }

	public string Type { get; set; } = "Hourly";

	public bool IsActive { get; set; } = true;

	public int MinTenureMonths { get; set; }

	public decimal MinWorkedHours { get; set; }

	public string? RaiseConditionNote { get; set; }
}
