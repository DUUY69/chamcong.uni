namespace WorkforceManagement.Api.Data;

public class AnnouncementStore
{
	public int AnnouncementId { get; set; }

	public int StoreId { get; set; }

	public Announcement Announcement { get; set; }

	public Store Store { get; set; }
}
