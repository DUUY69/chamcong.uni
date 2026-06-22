using System.Collections.Generic;

namespace WorkforceManagement.Api.Models.Employee;

public static class EducationLevelValues
{
	public static readonly HashSet<string> Allowed = new HashSet<string> { "THPT", "CaoDang", "DaiHoc", "DaoTaoNghe" };
}
