namespace WorkforceManagement.Api.Controllers;

public class CreateAdminDto
{
	public string Username { get; set; } = "admin";

	public string Email { get; set; } = "admin@workforce.vn";

	public string Password { get; set; } = "";
}
