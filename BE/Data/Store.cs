using System;
using System.Collections.Generic;

namespace WorkforceManagement.Api.Data;

public class Store
{
	public int Id { get; set; }

	public string Name { get; set; } = "";

	public string? Address { get; set; }

	public string? Phone { get; set; }

	public decimal StandardWorkHoursPerDay { get; set; } = 8m;

	public decimal OvertimeRateMultiplier { get; set; } = 1.5m;

	public int RequiredStaffPerDay { get; set; } = 5;

	public int RegistrationHorizonDays { get; set; }

	public bool IsActive { get; set; } = true;

	public int? ManagerEmployeeId { get; set; }

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public DateTime? UpdatedAt { get; set; }

	public Employee? Manager { get; set; }

	public ICollection<EmployeeStore> EmployeeStores { get; set; } = new List<EmployeeStore>();

	public ICollection<Shift> Shifts { get; set; } = new List<Shift>();

	public ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();

	public ICollection<Payroll> Payrolls { get; set; } = new List<Payroll>();
}
