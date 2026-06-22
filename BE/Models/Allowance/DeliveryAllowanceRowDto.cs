namespace WorkforceManagement.Api.Models.Allowance;

public class DeliveryAllowanceRowDto
{
	public int? Id { get; set; }

	public int EmployeeId { get; set; }

	public string EmployeeCode { get; set; } = "";

	public string EmployeeName { get; set; } = "";

	public decimal Amount { get; set; }

	public string? Note { get; set; }
}
