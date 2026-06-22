using System.Collections.Generic;

namespace WorkforceManagement.Api.Models.Employee;

public class EmployeeDto
{
	public int Id { get; set; }

	public int UserId { get; set; }

	public string EmployeeCode { get; set; } = "";

	public string FullName { get; set; } = "";

	public string? DateOfBirth { get; set; }

	public string? Gender { get; set; }

	public string? NationalId { get; set; }

	public string? Phone { get; set; }

	public string? Address { get; set; }

	public string? EducationLevel { get; set; }

	public string? EmergencyContact { get; set; }

	public string? BankAccountNo { get; set; }

	public string? BankName { get; set; }

	public string? BankAccountName { get; set; }

	public string StartDate { get; set; } = "";

	public bool IsActive { get; set; }

	public string Role { get; set; } = "";

	public string Username { get; set; } = "";

	public string Email { get; set; } = "";

	public int? PrimaryStoreId { get; set; }

	public string? PrimaryStoreName { get; set; }

	public List<int> StoreIds { get; set; } = new List<int>();

	public List<string> StoreNames { get; set; } = new List<string>();

	public SalaryCoefficientDto? CurrentSalary { get; set; }
}
