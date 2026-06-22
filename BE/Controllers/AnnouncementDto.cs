using System.Collections.Generic;

namespace WorkforceManagement.Api.Controllers;

public class AnnouncementDto
{
	public int Id { get; set; }

	public string Title { get; set; } = "";

	public string? Content { get; set; }

	public string? LinkUrl { get; set; }

	public string AnnouncementType { get; set; } = "";

	public string Scope { get; set; } = "";

	public List<int> StoreIds { get; set; } = new List<int>();

	public List<string> StoreNames { get; set; } = new List<string>();

	public int? CreatedBy { get; set; }

	public string CreatedByName { get; set; } = "";

	public bool IsActive { get; set; }

	public string CreatedAt { get; set; } = "";

	public string? UpdatedAt { get; set; }
}
