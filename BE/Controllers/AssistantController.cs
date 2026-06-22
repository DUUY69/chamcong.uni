using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WorkforceManagement.Api.Services;

namespace WorkforceManagement.Api.Controllers;

[ApiController]
[Route("api/assistant")]
[Authorize]
public class AssistantController : ControllerBase
{
    private readonly WorkforceAssistantService _assistant;

    public AssistantController(WorkforceAssistantService assistant) => _assistant = assistant;

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] WorkforceAssistantChatRequest req)
    {
        var result = await _assistant.ChatAsync(User, req.Message);
        return Ok(new
        {
            matched = result.Matched,
            reply = result.Reply,
            actionUrl = result.ActionUrl,
            rows = result.Rows,
            system = "chamcong",
        });
    }

    [HttpGet("proxy")]
    public async Task<IActionResult> Proxy([FromQuery] string handler, [FromQuery] string? q)
    {
        var body = await _assistant.ProxyHandlerAsync(User, handler, q);
        return Content(body ?? "Không có dữ liệu.", "text/plain; charset=utf-8");
    }

    [HttpGet("status")]
    public IActionResult Status() =>
        Ok(new { system = "chamcong", ready = true, version = "1.0" });
}
