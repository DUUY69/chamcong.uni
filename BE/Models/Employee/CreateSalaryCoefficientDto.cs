namespace WorkforceManagement.Api.Models.Employee;

public class CreateSalaryCoefficientDto
{
	public int EmployeeId { get; set; }

	public decimal BaseSalaryPerHour { get; set; }

	public string SalaryType { get; set; } = "Hourly";

	public decimal Coefficient { get; set; } = 1.0m;

	public string? EffectiveFrom { get; set; }

	public string? Note { get; set; }

	public int? SalaryGradeId { get; set; }
}
