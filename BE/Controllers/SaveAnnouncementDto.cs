using System.Collections.Generic;

namespace WorkforceManagement.Api.Controllers;

public class SaveAnnouncementDto
{
	public string Title { get; set; } = "";

	public string? Content { get; set; }

	public string? LinkUrl { get; set; }

	public string AnnouncementType { get; set; } = "";

	public string Scope { get; set; } = "AllStores";

	public List<int>? StoreIds { get; set; }
}
