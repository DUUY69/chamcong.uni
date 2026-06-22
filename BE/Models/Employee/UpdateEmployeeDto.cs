using System.Collections.Generic;

namespace WorkforceManagement.Api.Models.Employee;

public class UpdateEmployeeDto
{
	public string FullName { get; set; } = "";

	public string? Phone { get; set; }

	public string? DateOfBirth { get; set; }

	public string? Gender { get; set; }

	public string? NationalId { get; set; }

	public string? Address { get; set; }

	public string? EducationLevel { get; set; }

	public string? EmergencyContact { get; set; }

	public string? BankAccountNo { get; set; }

	public string? BankName { get; set; }

	public string? BankAccountName { get; set; }

	public int? PrimaryStoreId { get; set; }

	public List<int> StoreIds { get; set; } = new List<int>();
}
