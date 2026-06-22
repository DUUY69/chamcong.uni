namespace WorkforceManagement.Api.Models.Store;

public class CreateStoreDto
{
	public string Name { get; set; } = "";

	public string? Address { get; set; }

	public string? Phone { get; set; }

	public decimal? StandardWorkHoursPerDay { get; set; }

	public decimal? OvertimeRateMultiplier { get; set; }

	public int? ManagerEmployeeId { get; set; }
}
