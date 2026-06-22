using System.Collections.Generic;

namespace WorkforceManagement.Api.Models.Employee;

public class CreateEmployeeDto
{
	public string FullName { get; set; } = "";

	public string Email { get; set; } = "";

	public string Username { get; set; } = "";

	public string Password { get; set; } = "";

	public string Role { get; set; } = "Employee";

	public string? Phone { get; set; }

	public string? DateOfBirth { get; set; }

	public string? Gender { get; set; }

	public string? NationalId { get; set; }

	public string? Address { get; set; }

	public string? EducationLevel { get; set; }

	public string? BankAccountNo { get; set; }

	public string? BankName { get; set; }

	public string? BankAccountName { get; set; }

	public string StartDate { get; set; } = "";

	public int? PrimaryStoreId { get; set; }

	public List<int> StoreIds { get; set; } = new List<int>();

	public decimal? BaseSalaryPerHour { get; set; }

	public decimal? Coefficient { get; set; }

	public int? SalaryGradeId { get; set; }
}
