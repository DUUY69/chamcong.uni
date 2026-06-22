using System.Collections.Generic;

namespace WorkforceManagement.Api.Models.Payroll;

public class PayrollDto
{
	public int Id { get; set; }

	public int StoreId { get; set; }

	public string StoreName { get; set; } = "";

	public int Month { get; set; }

	public int Year { get; set; }

	public string Status { get; set; } = "";

	public decimal TotalAmount { get; set; }

	public string CreatedAt { get; set; } = "";

	public string? ApprovedAt { get; set; }

	public List<PayrollDetailDto> Details { get; set; } = new List<PayrollDetailDto>();
}
