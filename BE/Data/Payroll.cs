using System;
using System.Collections.Generic;

namespace WorkforceManagement.Api.Data;

public class Payroll
{
	public int Id { get; set; }

	public int StoreId { get; set; }

	public int Month { get; set; }

	public int Year { get; set; }

	public string Status { get; set; } = "Draft";

	public decimal TotalAmount { get; set; }

	public int CreatedBy { get; set; }

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public int? ApprovedBy { get; set; }

	public DateTime? ApprovedAt { get; set; }

	public Store Store { get; set; }

	public User CreatedByUser { get; set; }

	public User? ApprovedByUser { get; set; }

	public ICollection<PayrollDetail> Details { get; set; } = new List<PayrollDetail>();

	public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
