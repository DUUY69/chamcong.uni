using System.Collections.Generic;

namespace WorkforceManagement.Api.Models;

public class ApiResponse<T>
{
	public bool Success { get; set; }

	public T? Data { get; set; }

	public string Message { get; set; } = "";

	public List<string> Errors { get; set; } = new List<string>();

	public static ApiResponse<T> Ok(T data, string message = "")
	{
		return new ApiResponse<T>
		{
			Success = true,
			Data = data,
			Message = message
		};
	}

	public static ApiResponse<T> Fail(string message, List<string>? errors = null)
	{
		return new ApiResponse<T>
		{
			Success = false,
			Message = message,
			Errors = (errors ?? new List<string>())
		};
	}
}
public class ApiResponse : ApiResponse<object>
{
	public static ApiResponse Ok(string message = "")
	{
		return new ApiResponse
		{
			Success = true,
			Message = message
		};
	}

	public new static ApiResponse Fail(string message, List<string>? errors = null)
	{
		return new ApiResponse
		{
			Success = false,
			Message = message,
			Errors = (errors ?? new List<string>())
		};
	}
}
