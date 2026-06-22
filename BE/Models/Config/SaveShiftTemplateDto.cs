namespace WorkforceManagement.Api.Models.Config;

public class SaveShiftTemplateDto
{
	public string Name { get; set; } = "";

	public string StartTime { get; set; } = "";

	public string EndTime { get; set; } = "";

	public string? ColorHex { get; set; }

	public int SortOrder { get; set; }

	public bool IsActive { get; set; } = true;
}
