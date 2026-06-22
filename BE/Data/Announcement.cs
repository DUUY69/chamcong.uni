using System;
using System.Collections.Generic;

namespace WorkforceManagement.Api.Data;

public class Announcement
{
	public int Id { get; set; }

	public string Title { get; set; } = "";

	public string? Content { get; set; }

	public string? LinkUrl { get; set; }

	public string AnnouncementType { get; set; } = "";

	public string Scope { get; set; } = "";

	public int? CreatedBy { get; set; }

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public DateTime? UpdatedAt { get; set; }

	public bool IsActive { get; set; } = true;

	public Employee? Creator { get; set; }

	public ICollection<AnnouncementStore> AnnouncementStores { get; set; } = new List<AnnouncementStore>();
}
