namespace WorkforceManagement.Api.Models.Auth;

public class UserInfo
{
	public int Id { get; set; }

	public string Username { get; set; } = "";

	public string Email { get; set; } = "";

	public string Role { get; set; } = "";

	public string FullName { get; set; } = "";

	public int? EmployeeId { get; set; }
}
