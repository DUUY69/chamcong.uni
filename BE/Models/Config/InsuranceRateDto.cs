namespace WorkforceManagement.Api.Models.Config;

public class InsuranceRateDto
{
	public int Id { get; set; }

	public string Code { get; set; } = "";

	public string? Label { get; set; }

	public decimal Amount { get; set; }

	public bool IsActive { get; set; }

	public string CreatedAt { get; set; } = "";
}
