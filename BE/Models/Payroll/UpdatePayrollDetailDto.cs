namespace WorkforceManagement.Api.Models.Payroll;

public class UpdatePayrollDetailDto
{
	public decimal? Bonus { get; set; }

	public decimal? DeliveryAllowance { get; set; }

	public decimal? Deduction { get; set; }

	public string? Note { get; set; }
}
