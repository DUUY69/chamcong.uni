namespace WorkforceManagement.Api.Models.Config;

public class SaveInsuranceRateDto
{
	public string Code { get; set; } = "";

	public string? Label { get; set; }

	public decimal Amount { get; set; }

	public bool IsActive { get; set; } = true;
}
