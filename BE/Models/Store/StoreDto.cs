namespace WorkforceManagement.Api.Models.Store;

public class StoreDto
{
	public int Id { get; set; }

	public string Name { get; set; } = "";

	public string? Address { get; set; }

	public string? Phone { get; set; }

	public bool IsActive { get; set; }

	public int EmployeeCount { get; set; }

	public decimal StandardWorkHoursPerDay { get; set; }

	public decimal OvertimeRateMultiplier { get; set; }

	public int RequiredStaffPerDay { get; set; } = 5;

	public int? ManagerEmployeeId { get; set; }

	public string? ManagerName { get; set; }

	public string? ManagerCode { get; set; }
}
