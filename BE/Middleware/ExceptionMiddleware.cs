using System;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using WorkforceManagement.Api.Models;

namespace WorkforceManagement.Api.Middleware;

public class ExceptionMiddleware
{
	private readonly RequestDelegate _next;

	private readonly ILogger<ExceptionMiddleware> _logger;

	public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
	{
		_next = next;
		_logger = logger;
	}

	public async Task InvokeAsync(HttpContext context)
	{
		try
		{
			await _next(context);
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
			context.Response.StatusCode = 500;
			context.Response.ContentType = "application/json";
			ApiResponse value = ApiResponse.Fail("Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.");
			await context.Response.WriteAsync(JsonSerializer.Serialize(value, new JsonSerializerOptions
			{
				PropertyNamingPolicy = JsonNamingPolicy.CamelCase
			}));
		}
	}
}
