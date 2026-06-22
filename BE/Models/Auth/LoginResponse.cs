namespace WorkforceManagement.Api.Models.Auth;

public class LoginResponse
{
	public string AccessToken { get; set; } = "";

	public string RefreshToken { get; set; } = "";

	public int ExpiresIn { get; set; }

	public UserInfo User { get; set; }
}
