using System.Text.Json.Serialization;

namespace WorkforceManagement.Api.Models.Employee;

public class SalaryCoefficientDto
{
	public int Id { get; set; }

	public int EmployeeId { get; set; }

	public decimal BaseSalaryPerHour { get; set; }

	[JsonPropertyName("baseSalaryPerDay")]
	public decimal BaseSalaryPerDay
	{
		get
		{
			return BaseSalaryPerHour;
		}
		set
		{
			BaseSalaryPerHour = value;
		}
	}

	public string SalaryType { get; set; } = "Hourly";

	public decimal Coefficient { get; set; }

	public string EffectiveFrom { get; set; } = "";

	public string? Note { get; set; }

	public string CreatedAt { get; set; } = "";

	public string? CreatedByName { get; set; }

	public string? CreatedByRole { get; set; }
}
