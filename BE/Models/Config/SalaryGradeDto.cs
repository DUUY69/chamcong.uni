namespace WorkforceManagement.Api.Models.Config;

public class SalaryGradeDto
{
	public int Id { get; set; }

	public string Code { get; set; } = "";

	public string? Label { get; set; }

	public decimal Value { get; set; }

	public string Type { get; set; } = "Hourly";

	public bool IsActive { get; set; }

	public int MinTenureMonths { get; set; }

	public decimal MinWorkedHours { get; set; }

	public string? RaiseConditionNote { get; set; }

	public string CreatedAt { get; set; } = "";
}
