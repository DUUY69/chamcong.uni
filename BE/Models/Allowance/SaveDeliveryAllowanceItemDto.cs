namespace WorkforceManagement.Api.Models.Allowance;

public class SaveDeliveryAllowanceItemDto
{
	public int EmployeeId { get; set; }

	public decimal Amount { get; set; }

	public string? Note { get; set; }
}
