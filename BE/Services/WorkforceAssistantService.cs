using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Models.Attendance;

namespace WorkforceManagement.Api.Services;

public sealed class WorkforceAssistantService
{
    private readonly AppDbContext _db;

    public WorkforceAssistantService(AppDbContext db) => _db = db;

    public async Task<WorkforceAssistantReply> ChatAsync(ClaimsPrincipal user, string? message)
    {
        var q = Normalize(message ?? "");
        if (IsGreeting(q))
            return Reply("Em chào anh/chị! Em là Trợ lý chấm công — hỏi «ca hôm nay», «ai trễ», «ca chờ duyệt» nhé.", "/dashboard/home");
        if (IsHelp(q))
            return HelpReply();

        var role = user.FindFirstValue(ClaimTypes.Role) ?? "";
        var employeeId = ParseEmployeeId(user);

        if (Matches(q, "cham cong hom nay", "hom nay em cham", "cham chua", "da cham chua"))
            return await MyAttendanceTodayAsync(employeeId, role);
        if (Matches(q, "ai tre", "tre hom nay", "di tre"))
            return await LateTodayAsync(user, role);
        if (Matches(q, "ca cho duyet", "cho duyet", "pending ca"))
            return await PendingShiftsAsync(user, role);
        if (Matches(q, "chua check", "chua vao ca", "chua check in", "thieu check"))
            return await MissingCheckinAsync(user, role);
        if (Matches(q, "ca hom nay", "lich hom nay"))
            return await MyShiftsTodayAsync(employeeId, role);

        return Reply(
            "Em chưa hiểu rõ. Anh thử:\n• «hôm nay em chấm chưa»\n• «ai trễ hôm nay»\n• «ca chờ duyệt»\n• «bạn có thể làm gì»",
            "/dashboard/home");
    }

    public async Task<string?> ProxyHandlerAsync(ClaimsPrincipal user, string handler, string? q)
    {
        var reply = await ChatAsync(user, q ?? handler);
        return reply.Reply;
    }

    private async Task<WorkforceAssistantReply> MyAttendanceTodayAsync(int? employeeId, string role)
    {
        if (role == "Employee" && employeeId == null)
            return Reply("Tài khoản chưa liên kết nhân viên.", "/dashboard/profile");

        var today = DateOnly.FromDateTime(DateTime.Now);
        var q = _db.Attendances.Include(a => a.Store).AsNoTracking()
            .Where(a => a.WorkDate == today);
        if (role == "Employee" && employeeId.HasValue)
            q = q.Where(a => a.EmployeeId == employeeId.Value);

        var list = await q.OrderByDescending(a => a.CheckIn).Take(5).ToListAsync();
        if (list.Count == 0)
            return Reply("Hôm nay chưa có bản ghi chấm công.", "/dashboard/attendance");

        var lines = list.Select(a =>
            $"• {a.Store?.Name ?? "CH"} — {AttendanceStatuses.Label(a.Status)} — vào {a.CheckIn:HH:mm} ra {(a.CheckOut?.ToString("HH:mm") ?? "chưa ra")}");
        return Reply("Chấm công hôm nay:\n" + string.Join("\n", lines), "/dashboard/attendance");
    }

    private async Task<WorkforceAssistantReply> LateTodayAsync(ClaimsPrincipal user, string role)
    {
        if (role == "Employee")
            return Reply("Tra «ai trễ» dành cho quản lý/admin.", "/dashboard/attendance");

        var today = DateOnly.FromDateTime(DateTime.Now);
        var scope = new UserStoreScope(_db, user);
        var storeIds = await scope.GetManagedStoreIdsAsync();

        var q = _db.Attendances.Include(a => a.Employee).Include(a => a.Store).AsNoTracking()
            .Where(a => a.WorkDate == today && a.Status == AttendanceStatuses.Worked);
        if (storeIds != null)
            q = q.Where(a => storeIds.Contains(a.StoreId));

        var list = await q.OrderBy(a => a.CheckIn).Take(20).ToListAsync();
        var late = list.Where(a =>
        {
            var shiftStart = new TimeOnly(6, 0);
            return a.CheckIn > shiftStart.AddMinutes(5);
        }).Take(10).ToList();
        if (late.Count == 0)
            return Reply("Hôm nay không ai đi trễ (theo ca sáng 06:00).", "/dashboard/attendance");

        var lines = late.Select(a =>
            $"• {a.Employee?.FullName ?? "NV"} — {a.Store?.Name} — vào {a.CheckIn:HH:mm}");
        return Reply($"Ai trễ hôm nay ({late.Count}):\n" + string.Join("\n", lines), "/dashboard/attendance");
    }

    private async Task<WorkforceAssistantReply> PendingShiftsAsync(ClaimsPrincipal user, string role)
    {
        if (role == "Employee")
            return Reply("«Ca chờ duyệt» dành cho quản lý. NV xem «ca hôm nay của em».", "/dashboard/shift-registrations");

        var scope = new UserStoreScope(_db, user);
        var storeIds = await scope.GetManagedStoreIdsAsync();
        var q = _db.ShiftRegistrations.Include(r => r.Employee).Include(r => r.Store).AsNoTracking()
            .Where(r => r.Status == "Pending");
        if (storeIds != null)
            q = q.Where(r => storeIds.Contains(r.StoreId));

        var list = await q.OrderBy(r => r.WorkDate).ThenBy(r => r.StartTime).Take(12).ToListAsync();
        if (list.Count == 0)
            return Reply("Không có ca chờ duyệt.", "/dashboard/shift-registrations");

        var rows = list.Select(r => new WorkforceAssistantRow
        {
            Title = $"{r.Employee?.FullName} · {r.WorkDate:dd/MM}",
            Subtitle = $"{r.Store?.Name} · {r.StartTime:HH:mm}–{r.EndTime:HH:mm}",
            Link = "/dashboard/shift-registrations",
        }).ToList();
        return Reply($"Có {list.Count} ca chờ duyệt:", "/dashboard/shift-registrations", rows);
    }

    private async Task<WorkforceAssistantReply> MissingCheckinAsync(ClaimsPrincipal user, string role)
    {
        if (role == "Employee")
            return Reply("Hỏi quản lý hoặc admin về CH chưa check-in.", "/dashboard/attendance");

        var today = DateOnly.FromDateTime(DateTime.Now);
        var scope = new UserStoreScope(_db, user);
        var storeIds = await scope.GetManagedStoreIdsAsync();

        var approved = _db.ShiftRegistrations.AsNoTracking()
            .Where(r => r.WorkDate == today && r.Status == "Approved");
        if (storeIds != null)
            approved = approved.Where(r => storeIds.Contains(r.StoreId));

        var approvedList = await approved.Include(r => r.Employee).Include(r => r.Store).ToListAsync();
        var checkedIn = await _db.Attendances.AsNoTracking()
            .Where(a => a.WorkDate == today && a.Status == AttendanceStatuses.Worked)
            .Select(a => a.EmployeeId)
            .Distinct()
            .ToListAsync();
        var missing = approvedList
            .Where(r => !checkedIn.Contains(r.EmployeeId))
            .GroupBy(r => r.EmployeeId)
            .Select(g => g.First())
            .Take(10)
            .ToList();

        if (missing.Count == 0)
            return Reply("Các NV đã duyệt ca hôm nay đều đã check-in (hoặc chưa có ca duyệt).", "/dashboard/attendance");

        var lines = missing.Select(r =>
            $"• {r.Employee?.FullName} — {r.Store?.Name} · {r.StartTime:HH:mm}–{r.EndTime:HH:mm}");
        return Reply("Chưa check-in (có ca duyệt):\n" + string.Join("\n", lines), "/dashboard/attendance");
    }

    private async Task<WorkforceAssistantReply> MyShiftsTodayAsync(int? employeeId, string role)
    {
        if (employeeId == null)
            return Reply("Chưa liên kết nhân viên.", "/dashboard/profile");
        var today = DateOnly.FromDateTime(DateTime.Now);
        var list = await _db.ShiftRegistrations.Include(r => r.Store).AsNoTracking()
            .Where(r => r.EmployeeId == employeeId.Value && r.WorkDate == today
                && (r.Status == "Pending" || r.Status == "Approved"))
            .OrderBy(r => r.StartTime)
            .ToListAsync();
        if (list.Count == 0)
            return Reply("Hôm nay chưa có ca đăng ký/duyệt.", "/dashboard/shift-registrations");
        var lines = list.Select(r =>
            $"• {r.Store?.Name} — {r.StartTime:HH:mm}–{r.EndTime:HH:mm} — {r.Status}");
        return Reply("Ca hôm nay:\n" + string.Join("\n", lines), "/dashboard/shift-registrations");
    }

    private static WorkforceAssistantReply HelpReply() => Reply(
        "Em có thể giúp:\n• «hôm nay em chấm chưa»\n• «ai trễ hôm nay»\n• «ca chờ duyệt»\n• «ai chưa check-in»\n• «ca hôm nay của em»",
        "/dashboard/home");

    private static WorkforceAssistantReply Reply(string text, string? url, List<WorkforceAssistantRow>? rows = null) =>
        new() { Reply = text, ActionUrl = url, Rows = rows, Matched = true };

    private static bool IsGreeting(string q) =>
        Matches(q, "xin chao", "chao em", "hello", "hi");
    private static bool IsHelp(string q) =>
        Matches(q, "lam gi", "giup gi", "ban co the", "huong dan");

    private static bool Matches(string q, params string[] patterns) =>
        patterns.Any(p => q.Contains(Normalize(p), StringComparison.Ordinal));

    private static string Normalize(string s) =>
        Regex.Replace(s.ToLowerInvariant(), @"[^a-z0-9\s]", " ").Replace("  ", " ").Trim();

    private static int? ParseEmployeeId(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue("employeeId");
        return int.TryParse(raw, out var id) && id > 0 ? id : null;
    }
}

public sealed class WorkforceAssistantReply
{
    public bool Matched { get; set; }
    public string Reply { get; set; } = "";
    public string? ActionUrl { get; set; }
    public List<WorkforceAssistantRow>? Rows { get; set; }
}

public sealed class WorkforceAssistantRow
{
    public string Title { get; set; } = "";
    public string? Subtitle { get; set; }
    public string? Link { get; set; }
}

public sealed class WorkforceAssistantChatRequest
{
    public string? Message { get; set; }
    public string? System { get; set; }
}
