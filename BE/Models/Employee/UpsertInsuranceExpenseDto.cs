namespace WorkforceManagement.Api.Models.Employee;

public class UpsertInsuranceExpenseDto
{
	public int Year { get; set; }

	public int Month { get; set; }

	public decimal Amount { get; set; }

	public string? Note { get; set; }
}
