namespace WorkforceManagement.Api.Models.Config;

public class SaveHolidayDto
{
	public string Date { get; set; } = "";

	public string Name { get; set; } = "";

	public decimal Multiplier { get; set; } = 3.0m;

	public bool IsActive { get; set; } = true;
}
