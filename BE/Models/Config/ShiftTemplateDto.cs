namespace WorkforceManagement.Api.Models.Config;

public class ShiftTemplateDto
{
	public int Id { get; set; }

	public string Name { get; set; } = "";

	public string StartTime { get; set; } = "";

	public string EndTime { get; set; } = "";

	public string? ColorHex { get; set; }

	public int SortOrder { get; set; }

	public bool IsActive { get; set; }

	public string CreatedAt { get; set; } = "";
}
