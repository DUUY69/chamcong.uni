namespace WorkforceManagement.Api.Models.Config;

public class HolidayDto
{
	public int Id { get; set; }

	public string Date { get; set; } = "";

	public string Name { get; set; } = "";

	public decimal Multiplier { get; set; }

	public bool IsActive { get; set; }

	public string CreatedAt { get; set; } = "";
}
