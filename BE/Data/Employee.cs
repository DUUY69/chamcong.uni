using System;
using System.Collections.Generic;

namespace WorkforceManagement.Api.Data;

public class Employee
{
	public int Id { get; set; }

	public int UserId { get; set; }

	public string EmployeeCode { get; set; } = "";

	public string FullName { get; set; } = "";

	public DateOnly? DateOfBirth { get; set; }

	public string? Gender { get; set; }

	public string? NationalId { get; set; }

	public string? Phone { get; set; }

	public string? Address { get; set; }

	public string? EducationLevel { get; set; }

	public string? EmergencyContact { get; set; }

	public string? BankAccountNo { get; set; }

	public string? BankName { get; set; }

	public string? BankAccountName { get; set; }

	public DateOnly StartDate { get; set; }

	public int? PrimaryStoreId { get; set; }

	public bool IsActive { get; set; } = true;

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public DateTime? UpdatedAt { get; set; }

	public User User { get; set; }

	public Store? PrimaryStore { get; set; }

	public ICollection<EmployeeStore> EmployeeStores { get; set; } = new List<EmployeeStore>();

	public ICollection<ShiftRegistration> ShiftRegistrations { get; set; } = new List<ShiftRegistration>();

	public ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();

	public ICollection<SalaryCoefficient> SalaryCoefficients { get; set; } = new List<SalaryCoefficient>();

	public ICollection<PayrollDetail> PayrollDetails { get; set; } = new List<PayrollDetail>();
}
