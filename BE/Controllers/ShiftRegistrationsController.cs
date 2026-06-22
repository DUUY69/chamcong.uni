using System.Security.Claims;

using Microsoft.AspNetCore.Authorization;

using Microsoft.AspNetCore.Mvc;

using Microsoft.EntityFrameworkCore;

using WorkforceManagement.Api.Data;

using WorkforceManagement.Api.Models;

using WorkforceManagement.Api.Models.Shift;

using WorkforceManagement.Api.Services;



namespace WorkforceManagement.Api.Controllers;



[ApiController]

[Route("api/shift-registrations")]

[Authorize]

public class ShiftRegistrationsController : ControllerBase

{

    private readonly AppDbContext _db;

    public ShiftRegistrationsController(AppDbContext db) => _db = db;



    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

    private string Role => User.FindFirstValue(ClaimTypes.Role) ?? "";

    private int? EmployeeId

    {

        get

        {

            var raw = User.FindFirstValue("employeeId");

            return int.TryParse(raw, out var id) && id > 0 ? id : null;

        }

    }



    [HttpGet]

    public async Task<IActionResult> GetAll(

        [FromQuery] int? storeId, [FromQuery] int? employeeId,

        [FromQuery] string? status, [FromQuery] string? dateFrom, [FromQuery] string? dateTo)

    {

        var q = _db.ShiftRegistrations

            .Include(r => r.Employee)

            .Include(r => r.Shift)

            .Include(r => r.Store)

            .AsQueryable();



        if (Role == "Employee")

        {

            if (EmployeeId == null) return Ok(ApiResponse<List<ShiftRegistrationDto>>.Ok(new()));

            q = q.Where(r => r.EmployeeId == EmployeeId.Value);

        }

        else

        {

            var scope = new UserStoreScope(_db, User);

            var managedStoreIds = await scope.GetManagedStoreIdsAsync();

            if (managedStoreIds != null)

            {

                if (managedStoreIds.Count == 0) return Ok(ApiResponse<List<ShiftRegistrationDto>>.Ok(new()));

                if (storeId.HasValue && !managedStoreIds.Contains(storeId.Value))

                    return StatusCode(403, ApiResponse.Fail("Không có quyền xem cửa hàng này."));

                q = q.Where(r => managedStoreIds.Contains(r.StoreId));

            }



            if (employeeId.HasValue) q = q.Where(r => r.EmployeeId == employeeId.Value);

            if (storeId.HasValue) q = q.Where(r => r.StoreId == storeId.Value);

        }



        if (!string.IsNullOrEmpty(status)) q = q.Where(r => r.Status == status);

        if (DateOnly.TryParse(dateFrom, out var df)) q = q.Where(r => r.WorkDate >= df);

        if (DateOnly.TryParse(dateTo, out var dt)) q = q.Where(r => r.WorkDate <= dt);



        var list = await q.OrderByDescending(r => r.WorkDate).ThenBy(r => r.StartTime).ToListAsync();
        // Trả ca thật trong DB — modal NV gộp liền kề ở FE; lưới QL dùng overlap giờ.
        return Ok(ApiResponse<List<ShiftRegistrationDto>>.Ok(list.Select(MapDto).ToList()));

    }



    [HttpPost]

    [Authorize(Roles = "Employee")]

    public async Task<IActionResult> Create([FromBody] CreateShiftRegistrationDto dto)

    {

        if (EmployeeId == null) return BadRequest(ApiResponse.Fail("Tài khoản không phải nhân viên."));

        if (!DateOnly.TryParse(dto.WorkDate, out var workDate))

            return BadRequest(ApiResponse.Fail("Ngày làm không hợp lệ (yyyy-MM-dd)."));

        if (workDate <= DateOnly.FromDateTime(DateTime.Today))

            return BadRequest(ApiResponse.Fail("Không thể đăng ký ca cho ngày hôm nay hoặc quá khứ."));

        if (!TimeOnly.TryParse(dto.StartTime, out var startTime) || !TimeOnly.TryParse(dto.EndTime, out var endTime))

            return BadRequest(ApiResponse.Fail("Giờ làm không hợp lệ (HH:mm)."));

        if (endTime <= startTime)
            return BadRequest(ApiResponse.Fail("Giờ kết thúc phải sau giờ bắt đầu."));

        var storeOk = await _db.Stores.AnyAsync(s => s.Id == dto.StoreId && s.IsActive);
        if (!storeOk)
            return BadRequest(ApiResponse.Fail("Cửa hàng không tồn tại hoặc đã ngừng hoạt động."));

        var crossStore = await _db.ShiftRegistrations
            .Include(r => r.Store)
            .Where(r => r.EmployeeId == EmployeeId.Value
                && r.WorkDate == workDate
                && r.StoreId != dto.StoreId
                && (r.Status == "Pending" || r.Status == "Approved")
                && r.StartTime < endTime && startTime < r.EndTime)
            .FirstOrDefaultAsync();
        if (crossStore != null)
        {
            var otherName = crossStore.Store?.Name ?? "cửa hàng khác";
            return BadRequest(ApiResponse.Fail(
                $"Trùng khung giờ với ca tại {otherName} ({crossStore.StartTime:HH:mm}–{crossStore.EndTime:HH:mm}). " +
                "Một ngày không thể làm hai nơi cùng lúc — hãy đổi giờ hoặc đổi ngày."));
        }

        // Cùng CH + trùng giờ: hủy ca cũ bị đè, lưu đúng khung NV vừa nhập (không gộp/giãn).
        var sameStoreOverlap = await _db.ShiftRegistrations
            .Where(r => r.EmployeeId == EmployeeId.Value
                && r.WorkDate == workDate
                && r.StoreId == dto.StoreId
                && (r.Status == "Pending" || r.Status == "Approved")
                && r.StartTime < endTime && startTime < r.EndTime)
            .ToListAsync();
        foreach (var old in sameStoreOverlap)
        {
            old.Status = "Cancelled";
            old.RejectReason = "Thay bằng ca đăng ký mới";
            old.ReviewedAt = DateTime.UtcNow;
        }

        var created = new ShiftRegistration
        {
            EmployeeId = EmployeeId.Value,
            ShiftId = null,
            StartTime = startTime,
            EndTime = endTime,
            StoreId = dto.StoreId,
            WorkDate = workDate,
            Status = "Pending",
        };
        _db.ShiftRegistrations.Add(created);
        await _db.SaveChangesAsync();
        // NV đăng ký: giữ nguyên 1 dòng đúng giờ nhập — không tách theo giờ (QL duyệt lưới mới tách).

        return Ok(ApiResponse.Ok("Đăng ký ca thành công."));

    }



    [HttpGet("staffing-summary")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> GetStaffingSummary(
        [FromQuery] int? storeId, [FromQuery] string? dateFrom, [FromQuery] string? dateTo)
    {
        if (!DateOnly.TryParse(dateFrom, out var from) || !DateOnly.TryParse(dateTo, out var to))
            return BadRequest(ApiResponse.Fail("dateFrom và dateTo bắt buộc (yyyy-MM-dd)."));
        if (to < from)
            return BadRequest(ApiResponse.Fail("dateTo phải >= dateFrom."));

        var scope = new UserStoreScope(_db, User);
        var managedStoreIds = await scope.GetManagedStoreIdsAsync();
        if (managedStoreIds != null && managedStoreIds.Count == 0)
            return Ok(ApiResponse<List<DayStaffingSummaryDto>>.Ok(new()));

        var storeQ = _db.Stores.Where(s => s.IsActive);
        if (managedStoreIds != null)
            storeQ = storeQ.Where(s => managedStoreIds.Contains(s.Id));
        if (storeId.HasValue)
        {
            if (managedStoreIds != null && !managedStoreIds.Contains(storeId.Value))
                return StatusCode(403, ApiResponse.Fail("Không có quyền xem cửa hàng này."));
            storeQ = storeQ.Where(s => s.Id == storeId.Value);
        }

        var stores = await storeQ.ToListAsync();
        if (stores.Count == 0)
            return Ok(ApiResponse<List<DayStaffingSummaryDto>>.Ok(new()));

        var storeIds = stores.Select(s => s.Id).ToList();
        var regs = await _db.ShiftRegistrations
            .Where(r => storeIds.Contains(r.StoreId) && r.WorkDate >= from && r.WorkDate <= to)
            .ToListAsync();
        var data = ShiftScheduleService.BuildStaffingSummaries(regs, stores, from, to);
        return Ok(ApiResponse<List<DayStaffingSummaryDto>>.Ok(data));
    }

    [HttpGet("day-labor-summary")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> GetDayLaborSummary(
        [FromQuery] int? storeId, [FromQuery] string? dateFrom, [FromQuery] string? dateTo)
    {
        if (!DateOnly.TryParse(dateFrom, out var from) || !DateOnly.TryParse(dateTo, out var to))
            return BadRequest(ApiResponse.Fail("dateFrom và dateTo bắt buộc (yyyy-MM-dd)."));
        if (to < from)
            return BadRequest(ApiResponse.Fail("dateTo phải >= dateFrom."));

        var scope = new UserStoreScope(_db, User);
        var managedStoreIds = await scope.GetManagedStoreIdsAsync();
        if (managedStoreIds != null && managedStoreIds.Count == 0)
            return Ok(ApiResponse<List<DayLaborSummaryDto>>.Ok(new()));

        var storeQ = _db.Stores.Where(s => s.IsActive);
        if (managedStoreIds != null)
            storeQ = storeQ.Where(s => managedStoreIds.Contains(s.Id));
        if (storeId.HasValue)
        {
            if (managedStoreIds != null && !managedStoreIds.Contains(storeId.Value))
                return StatusCode(403, ApiResponse.Fail("Không có quyền xem cửa hàng này."));
            storeQ = storeQ.Where(s => s.Id == storeId.Value);
        }

        var stores = await storeQ.ToListAsync();
        if (stores.Count == 0)
            return Ok(ApiResponse<List<DayLaborSummaryDto>>.Ok(new()));

        var storeIds = stores.Select(s => s.Id).ToList();
        var regs = await _db.ShiftRegistrations
            .Include(r => r.Employee).ThenInclude(e => e.User)
            .Include(r => r.Employee).ThenInclude(e => e.SalaryCoefficients)
            .Where(r => storeIds.Contains(r.StoreId) && r.WorkDate >= from && r.WorkDate <= to)
            .ToListAsync();
        var data = ShiftScheduleService.BuildDayLaborSummaries(regs, stores, from, to);
        return Ok(ApiResponse<List<DayLaborSummaryDto>>.Ok(data));
    }

    [HttpPost("approve-hour")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> ApproveHour([FromBody] HourSlotActionDto dto)
    {
        try { return await ApproveHourInternalAsync(dto); }
        catch (DbUpdateException ex) { return BadRequest(ApiResponse.Fail(MapShiftRegistrationDbError(ex))); }
    }

    private async Task<IActionResult> ApproveHourInternalAsync(HourSlotActionDto dto)
    {
        var (ok, start, end, workDate, err) = await ShiftRegistrationSliceService.ParseHourSlot(dto);
        if (!ok) return BadRequest(ApiResponse.Fail(err!));

        var scope = new UserStoreScope(_db, User);
        if (!await scope.CanAccessStoreAsync(dto.StoreId))
            return StatusCode(403, ApiResponse.Fail("Không có quyền duyệt cửa hàng này."));

        var hint = await _db.ShiftRegistrations
            .Where(r => r.EmployeeId == dto.EmployeeId && r.StoreId == dto.StoreId && r.WorkDate == workDate)
            .OrderBy(r => r.Status == "Pending" ? 0 : 1)
            .FirstOrDefaultAsync();

        var reg = await ShiftRegistrationSliceService.ResolveOrEnsureHourRegAsync(
            _db, hint, dto.EmployeeId, dto.StoreId, workDate, start, end);
        if (reg == null)
            return BadRequest(ApiResponse.Fail("Không tìm thấy ca 1 giờ này — chạy SQL dọn dữ liệu trùng hoặc tải lại lưới."));

        if (reg.Status == "Approved")
            return Ok(ApiResponse.Ok("Khung giờ này đã được duyệt."));
        if (reg.Status != "Pending")
            return BadRequest(ApiResponse.Fail($"Không thể duyệt ca trạng thái «{reg.Status}»."));

        string? capacityWarn = null;
        var currentCount = await ShiftScheduleService.CountActiveInSlotAsync(_db, reg.StoreId, reg.WorkDate, start, end, reg.Id);
        if (currentCount >= ShiftScheduleService.MaxStaffPerSlot)
            capacityWarn = $"Cảnh báo: Khung {start:HH:mm}–{end:HH:mm} đã đủ {ShiftScheduleService.MaxStaffPerSlot} NV (vẫn cho duyệt/phân ca).";

        var (can, approveErr) = await ShiftScheduleService.CanApproveAsync(_db, reg);
        if (!can) return BadRequest(ApiResponse.Fail(approveErr ?? "Không thể duyệt ca này."));

        reg.Status = "Approved";
        reg.ReviewedBy = CurrentUserId;
        reg.ReviewedAt = DateTime.UtcNow;
        await CancelDuplicateHourRegsAsync(reg);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok(capacityWarn == null ? "Đã duyệt khung giờ này." : $"Đã duyệt khung giờ này. {capacityWarn}"));
    }

    [HttpPost("cancel-hour")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> CancelHour([FromBody] HourSlotActionDto dto)
    {
        try { return await CancelHourInternalAsync(dto); }
        catch (DbUpdateException ex) { return BadRequest(ApiResponse.Fail(MapShiftRegistrationDbError(ex))); }
    }

    private async Task<IActionResult> CancelHourInternalAsync(HourSlotActionDto dto)
    {
        var (ok, start, end, workDate, err) = await ShiftRegistrationSliceService.ParseHourSlot(dto);
        if (!ok) return BadRequest(ApiResponse.Fail(err!));

        var scope = new UserStoreScope(_db, User);
        if (!await scope.CanAccessStoreAsync(dto.StoreId))
            return StatusCode(403, ApiResponse.Fail("Không có quyền bỏ phân ca tại cửa hàng này."));

        var hint = await _db.ShiftRegistrations
            .Where(r => r.EmployeeId == dto.EmployeeId && r.StoreId == dto.StoreId && r.WorkDate == workDate)
            .OrderBy(r => r.Status == "Pending" ? 0 : 1)
            .FirstOrDefaultAsync();

        var reg = await ShiftRegistrationSliceService.ResolveOrEnsureHourRegAsync(
            _db, hint, dto.EmployeeId, dto.StoreId, workDate, start, end);
        if (reg == null)
            return Ok(ApiResponse.Ok("Khung giờ này đã được bỏ trước đó."));

        if (reg.Status is "Cancelled" or "Rejected")
            return Ok(ApiResponse.Ok("Khung giờ này đã được bỏ."));

        reg.Status = "Cancelled";
        reg.ReviewedBy = CurrentUserId;
        reg.ReviewedAt = DateTime.UtcNow;
        await CancelDuplicateHourRegsAsync(reg);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("Đã bỏ khung giờ này — các giờ khác giữ nguyên."));
    }

    [HttpPatch("{id:int}/approve")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Approve(int id, [FromBody] CancelShiftSliceDto? dto = null)
    {
        try { return await ApproveInternalAsync(id, dto); }
        catch (DbUpdateException ex) { return BadRequest(ApiResponse.Fail(MapShiftRegistrationDbError(ex))); }
    }

    private async Task<IActionResult> ApproveInternalAsync(int id, CancelShiftSliceDto? dto)
    {
        var reg = await _db.ShiftRegistrations.FindAsync(id);
        if (reg == null) return NotFound(ApiResponse.Fail("Không tìm thấy đăng ký."));

        var scope = new UserStoreScope(_db, User);
        if (!await scope.CanAccessStoreAsync(reg.StoreId))
            return StatusCode(403, ApiResponse.Fail("Không có quyền duyệt đăng ký cửa hàng này."));

        TimeOnly sliceStart = default, sliceEnd = default;
        var hasSlice = dto != null
            && !string.IsNullOrWhiteSpace(dto.SliceStart)
            && !string.IsNullOrWhiteSpace(dto.SliceEnd)
            && TimeOnly.TryParse(dto.SliceStart, out sliceStart)
            && TimeOnly.TryParse(dto.SliceEnd, out sliceEnd);

        if (ShiftRegistrationSliceService.IsMultiHour(reg.StartTime, reg.EndTime) && !hasSlice)
            return BadRequest(ApiResponse.Fail("Ca dài hơn 1 giờ — cần duyệt từng khung giờ trên lưới (bấm ✓ tại ô giờ cụ thể)."));

        if (hasSlice)
        {
            reg = await ShiftRegistrationSliceService.ResolveOrEnsureHourRegAsync(
                _db, reg, reg.EmployeeId, reg.StoreId, reg.WorkDate, sliceStart, sliceEnd);
            if (reg == null)
                return BadRequest(ApiResponse.Fail("Khung giờ không còn hoạt động. Tải lại lưới."));
        }

        if (reg.Status == "Approved")
            return Ok(ApiResponse.Ok("Khung giờ này đã được duyệt."));
        if (reg.Status != "Pending")
            return BadRequest(ApiResponse.Fail($"Không thể duyệt ca trạng thái «{reg.Status}»."));

        var capStart = hasSlice ? sliceStart : reg.StartTime;
        var capEnd = hasSlice ? sliceEnd : reg.EndTime;
        string? capacityWarn2 = null;
        var currentCount2 = await ShiftScheduleService.CountActiveInSlotAsync(_db, reg.StoreId, reg.WorkDate, capStart, capEnd, reg.Id);
        if (currentCount2 >= ShiftScheduleService.MaxStaffPerSlot)
            capacityWarn2 = $"Cảnh báo: Khung {capStart:HH:mm}–{capEnd:HH:mm} đã đủ {ShiftScheduleService.MaxStaffPerSlot} NV (vẫn cho duyệt/phân ca).";

        var (ok, err) = await ShiftScheduleService.CanApproveAsync(_db, reg);
        if (!ok) return BadRequest(ApiResponse.Fail(err ?? "Không thể duyệt ca này."));

        reg.Status = "Approved";
        reg.ReviewedBy = CurrentUserId;
        reg.ReviewedAt = DateTime.UtcNow;
        await CancelDuplicateHourRegsAsync(reg);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok(capacityWarn2 == null ? "Đã duyệt khung giờ này." : $"Đã duyệt khung giờ này. {capacityWarn2}"));
    }

    private async Task CancelDuplicateHourRegsAsync(ShiftRegistration reg)
    {
        var dupes = await _db.ShiftRegistrations
            .Where(r => r.Id != reg.Id
                && r.EmployeeId == reg.EmployeeId
                && r.StoreId == reg.StoreId
                && r.WorkDate == reg.WorkDate
                && (r.Status == "Pending" || r.Status == "Approved"))
            .ToListAsync();
        foreach (var d in dupes.Where(d =>
                     (d.StartTime == reg.StartTime && d.EndTime == reg.EndTime)
                     || (ShiftTimeGrid.Overlaps(d.StartTime, d.EndTime, reg.StartTime, reg.EndTime)
                         && ShiftTimeGrid.SameAlignedHourSlot(d.StartTime, d.EndTime, reg.StartTime, reg.EndTime))))
        {
            d.Status = "Cancelled";
            d.ReviewedBy = CurrentUserId;
            d.ReviewedAt = DateTime.UtcNow;
            d.RejectReason = "Trùng khung giờ — giữ 1 dòng";
        }
        // Hủy ca dài cha nếu còn Pending/Approved và đã duyệt 1 giờ con
        var longParents = (await _db.ShiftRegistrations
            .Where(r => r.Id != reg.Id
                && r.EmployeeId == reg.EmployeeId
                && r.StoreId == reg.StoreId
                && r.WorkDate == reg.WorkDate
                && (r.Status == "Pending" || r.Status == "Approved")
                && r.StartTime <= reg.StartTime && r.EndTime >= reg.EndTime)
            .ToListAsync())
            .Where(r => ShiftRegistrationSliceService.IsMultiHour(r.StartTime, r.EndTime));
        foreach (var p in longParents)
        {
            p.Status = "Cancelled";
            p.ReviewedBy = CurrentUserId;
            p.ReviewedAt = DateTime.UtcNow;
            p.RejectReason = "Đã duyệt theo giờ — hủy ca dài";
        }
    }

    [HttpPatch("{id:int}/reassign")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Reassign(int id, [FromBody] ReassignShiftRegistrationDto dto)
    {
        try { return await ReassignInternalAsync(id, dto); }
        catch (DbUpdateException ex) { return BadRequest(ApiResponse.Fail(MapShiftRegistrationDbError(ex))); }
    }

    private async Task<IActionResult> ReassignInternalAsync(int id, ReassignShiftRegistrationDto dto)
    {
        var reg = await _db.ShiftRegistrations.FindAsync(id);
        if (reg == null) return NotFound(ApiResponse.Fail("Không tìm thấy đăng ký."));

        var scope = new UserStoreScope(_db, User);
        if (!await scope.CanAccessStoreAsync(reg.StoreId) && !await scope.CanAccessStoreAsync(dto.StoreId))
            return StatusCode(403, ApiResponse.Fail("Không có quyền phân công cửa hàng này."));

        if (!TimeOnly.TryParse(dto.StartTime, out var startTime) || !TimeOnly.TryParse(dto.EndTime, out var endTime))
            return BadRequest(ApiResponse.Fail("Giờ làm không hợp lệ (HH:mm)."));
        if (endTime <= startTime)
            return BadRequest(ApiResponse.Fail("Giờ kết thúc phải sau giờ bắt đầu."));
        if (!ShiftSlotRules.IsAllowedShift(startTime, endTime))
            return BadRequest(ApiResponse.Fail(ShiftSlotRules.AllowedShiftsMessage));
        if (!await _db.Stores.AnyAsync(s => s.Id == dto.StoreId && s.IsActive))
            return BadRequest(ApiResponse.Fail("Cửa hàng không tồn tại hoặc đã ngừng hoạt động."));
        if (!await scope.CanAccessStoreAsync(dto.StoreId))
            return StatusCode(403, ApiResponse.Fail("Không có quyền phân công sang cửa hàng này."));

        if (!string.IsNullOrWhiteSpace(dto.SliceStart) && !string.IsNullOrWhiteSpace(dto.SliceEnd)
            && TimeOnly.TryParse(dto.SliceStart, out var ss) && TimeOnly.TryParse(dto.SliceEnd, out var se))
        {
            var hourReg = await ShiftRegistrationSliceService.ResolveHourRegAsync(_db, reg, ss, se);
            if (hourReg == null)
                return BadRequest(ApiResponse.Fail("Khung giờ không còn hoạt động hoặc đã bị bỏ. Tải lại lưới."));
            reg = hourReg;
        }
        else if (reg.Status is not ("Pending" or "Approved"))
            return BadRequest(ApiResponse.Fail("Ca này đã bị hủy. Tải lại lưới rồi thử lại."));

        if (reg.Status is not ("Pending" or "Approved"))
            return BadRequest(ApiResponse.Fail("Chỉ có thể phân công ca đang chờ duyệt hoặc đã duyệt."));

        var workDate = reg.WorkDate;
        if (!string.IsNullOrWhiteSpace(dto.WorkDate))
        {
            if (!DateOnly.TryParse(dto.WorkDate, out workDate))
                return BadRequest(ApiResponse.Fail("WorkDate không hợp lệ (yyyy-MM-dd)."));
            if (workDate <= DateOnly.FromDateTime(DateTime.Today))
                return BadRequest(ApiResponse.Fail("Không thể phân công ca cho ngày hôm nay hoặc quá khứ."));
        }

        var dup = await _db.ShiftRegistrations.FirstOrDefaultAsync(r =>
            r.Id != reg.Id && r.EmployeeId == reg.EmployeeId && r.WorkDate == workDate
            && r.StartTime == startTime && r.EndTime == endTime
            && (r.Status == "Pending" || r.Status == "Approved"));
        if (dup != null)
        {
            reg.Status = "Cancelled";
            reg.ReviewedBy = CurrentUserId;
            reg.ReviewedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(ApiResponse.Ok("Ô đích đã có NV — đã bỏ khung giờ nguồn."));
        }

        var (moved, target) = await ShiftRegistrationSliceService.TryMoveOntoCancelledSlotAsync(
            _db, reg, dto.StoreId, workDate, startTime, endTime, CurrentUserId);
        if (moved) return Ok(ApiResponse.Ok("Đã đặt lại khung giờ (ô trước đó đã bỏ)."));
        if (target != null)
            return BadRequest(ApiResponse.Fail($"Ô đích đã có ca ({target.StartTime:HH:mm}–{target.EndTime:HH:mm})."));

        var overlap = await FindTimeOverlapAsync(reg.EmployeeId, workDate, startTime, endTime, reg.Id);
        if (overlap != null)
        {
            var sn = overlap.Store?.Name ?? "cửa hàng khác";
            return BadRequest(ApiResponse.Fail($"Trùng khung giờ với ca tại {sn} ({overlap.StartTime:HH:mm}–{overlap.EndTime:HH:mm})."));
        }

        reg.StoreId = dto.StoreId;
        reg.WorkDate = workDate;
        reg.StartTime = startTime;
        reg.EndTime = endTime;
        if (reg.Status == "Approved")
        {
            reg.ReviewedBy = CurrentUserId;
            reg.ReviewedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("Đã phân công lại khung giờ."));
    }

    [HttpPost("assign-slot")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> AssignSlot([FromBody] AssignShiftSlotDto dto)
    {
        try { return await AssignSlotInternalAsync(dto); }
        catch (DbUpdateException ex) { return BadRequest(ApiResponse.Fail(MapShiftRegistrationDbError(ex))); }
    }

    private async Task<IActionResult> AssignSlotInternalAsync(AssignShiftSlotDto dto)
    {
        if (dto.EmployeeId <= 0 || dto.StoreId <= 0)
            return BadRequest(ApiResponse.Fail("Thiếu nhân viên hoặc cửa hàng."));

        if (!DateOnly.TryParse(dto.WorkDate, out var workDate))
            return BadRequest(ApiResponse.Fail("Ngày làm không hợp lệ (yyyy-MM-dd)."));
        if (workDate <= DateOnly.FromDateTime(DateTime.Today))
            return BadRequest(ApiResponse.Fail("Không thể phân ca cho ngày hôm nay hoặc quá khứ."));

        if (!TimeOnly.TryParse(dto.StartTime, out var startTime) || !TimeOnly.TryParse(dto.EndTime, out var endTime))
            return BadRequest(ApiResponse.Fail("Giờ làm không hợp lệ (HH:mm)."));
        if (endTime <= startTime)
            return BadRequest(ApiResponse.Fail("Giờ kết thúc phải sau giờ bắt đầu."));
        (startTime, endTime) = ShiftTimeGrid.AlignToHourGrid(startTime, endTime);
        if (!ShiftSlotRules.IsAllowedShift(startTime, endTime))
            return BadRequest(ApiResponse.Fail(ShiftSlotRules.AllowedShiftsMessage));

        var scope = new UserStoreScope(_db, User);
        if (!await scope.CanAccessStoreAsync(dto.StoreId))
            return StatusCode(403, ApiResponse.Fail("Không có quyền phân ca tại cửa hàng này."));

        if (!await _db.Stores.AnyAsync(s => s.Id == dto.StoreId && s.IsActive))
            return BadRequest(ApiResponse.Fail("Cửa hàng không tồn tại hoặc đã ngừng hoạt động."));

        var emp = await _db.Employees.Include(e => e.User).FirstOrDefaultAsync(e => e.Id == dto.EmployeeId);
        if (emp == null || !emp.IsActive)
            return BadRequest(ApiResponse.Fail("Nhân viên không tồn tại hoặc đã nghỉ."));

        if (!await _db.EmployeeStores.AnyAsync(es => es.EmployeeId == dto.EmployeeId && es.StoreId == dto.StoreId))
            return BadRequest(ApiResponse.Fail("Nhân viên không thuộc cửa hàng này."));

        string? capacityWarn3 = null;
        var currentCount3 = await ShiftScheduleService.CountActiveInSlotAsync(_db, dto.StoreId, workDate, startTime, endTime, null);
        if (currentCount3 >= ShiftScheduleService.MaxStaffPerSlot)
            capacityWarn3 = $"Cảnh báo: Khung {startTime:HH:mm}–{endTime:HH:mm} đã đủ {ShiftScheduleService.MaxStaffPerSlot} NV (vẫn cho duyệt/phân ca).";

        var overlap = await FindTimeOverlapAsync(dto.EmployeeId, workDate, startTime, endTime, excludeId: null);
        if (overlap != null)
        {
            if (overlap.StoreId == dto.StoreId
                && ShiftRegistrationSliceService.OverlapsHourSlot(overlap.StartTime, overlap.EndTime, startTime, endTime))
            {
                var hourReg = await ShiftRegistrationSliceService.ResolveOrEnsureHourRegAsync(
                    _db, overlap, dto.EmployeeId, dto.StoreId, workDate, startTime, endTime);
                if (hourReg != null
                    && hourReg.Status is "Pending" or "Approved"
                    && ShiftTimeGrid.TryIntersect(
                        overlap.StartTime, overlap.EndTime, startTime, endTime,
                        out var isectStart, out var isectEnd)
                    && hourReg.StartTime == isectStart && hourReg.EndTime == isectEnd)
                {
                        if (hourReg.Status == "Approved")
                            return BadRequest(ApiResponse.Fail("NV đã được phân khung giờ này."));
                        hourReg.Status = "Approved";
                        hourReg.ReviewedBy = CurrentUserId;
                        hourReg.ReviewedAt = DateTime.UtcNow;
                        hourReg.RejectReason = null;
                        await _db.SaveChangesAsync();
                        var baseMsg = emp.User?.Role == "Employee"
                            ? "Đã phân ca cho NV — hiển thị trên app NV như đã đăng ký."
                            : "Đã phân NV vào khung giờ (tách từ ca dài).";
                        return Ok(ApiResponse.Ok(capacityWarn3 == null ? baseMsg : $"{baseMsg} {capacityWarn3}"));
                }
            }

            var overlapStore = overlap.Store?.Name ?? "cửa hàng khác";
            if (overlap.StoreId != dto.StoreId)
                return BadRequest(ApiResponse.Fail(
                    $"NV đã có ca {overlap.StartTime:HH:mm}–{overlap.EndTime:HH:mm} tại {overlapStore} (trùng khung giờ)."));
            return BadRequest(ApiResponse.Fail(
                $"NV đã có ca {overlap.StartTime:HH:mm}–{overlap.EndTime:HH:mm} trùng khung giờ này."));
        }

        var existing = await ShiftRegistrationSliceService.FindSlotAsync(
            _db, dto.EmployeeId, dto.StoreId, workDate, startTime, endTime);
        if (existing != null && existing.Status is "Pending" or "Approved")
            return BadRequest(ApiResponse.Fail("NV đã được phân khung giờ này."));

        if (existing != null && existing.Status is "Cancelled" or "Rejected")
        {
            existing.Status = "Approved";
            existing.ReviewedBy = CurrentUserId;
            existing.ReviewedAt = DateTime.UtcNow;
            existing.RejectReason = null;
            await _db.SaveChangesAsync();
            return Ok(ApiResponse.Ok(capacityWarn3 == null
                ? "Đã phân NV vào khung giờ (ô trước đó đã bỏ)."
                : $"Đã phân NV vào khung giờ (ô trước đó đã bỏ). {capacityWarn3}"));
        }

        _db.ShiftRegistrations.Add(new ShiftRegistration
        {
            EmployeeId = dto.EmployeeId,
            StoreId = dto.StoreId,
            WorkDate = workDate,
            StartTime = startTime,
            EndTime = endTime,
            Status = "Approved",
            ReviewedBy = CurrentUserId,
            ReviewedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        var okMsg2 = emp.User?.Role == "Employee"
            ? "Đã phân ca cho NV — hiển thị trên app NV như đã đăng ký."
            : "Đã phân NV vào khung giờ.";
        return Ok(ApiResponse.Ok(capacityWarn3 == null ? okMsg2 : $"{okMsg2} {capacityWarn3}"));
    }

    [HttpPatch("{id:int}/reject")]

    [Authorize(Roles = "Admin,Manager")]

    public async Task<IActionResult> Reject(int id, [FromBody] ReviewShiftRegistrationDto dto)

    {

        var reg = await _db.ShiftRegistrations.FindAsync(id);

        if (reg == null) return NotFound(ApiResponse.Fail("Không tìm thấy đăng ký."));

        var scope = new UserStoreScope(_db, User);

        if (!await scope.CanAccessStoreAsync(reg.StoreId))

            return StatusCode(403, ApiResponse.Fail("Không có quyền từ chối đăng ký cửa hàng này."));

        if (reg.Status != "Pending") return BadRequest(ApiResponse.Fail("Chỉ có thể từ chối đăng ký đang Pending."));

        reg.Status = "Rejected";

        reg.RejectReason = dto.RejectReason;

        reg.ReviewedBy = CurrentUserId;

        reg.ReviewedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("Đã từ chối."));

    }



    [HttpPatch("{id:int}/cancel")]
    [Authorize(Roles = "Employee,Manager,Admin")]
    public async Task<IActionResult> Cancel(int id, [FromBody] CancelShiftSliceDto? dto = null)
    {
        try { return await CancelInternalAsync(id, dto); }
        catch (DbUpdateException ex) { return BadRequest(ApiResponse.Fail(MapShiftRegistrationDbError(ex))); }
    }

    private async Task<IActionResult> CancelInternalAsync(int id, CancelShiftSliceDto? dto)
    {
        var reg = await _db.ShiftRegistrations.FindAsync(id);
        if (reg == null) return NotFound(ApiResponse.Fail("Không tìm thấy đăng ký."));

        var isManager = Role is "Manager" or "Admin";
        if (isManager)
        {
            var scope = new UserStoreScope(_db, User);
            if (!await scope.CanAccessStoreAsync(reg.StoreId))
                return StatusCode(403, ApiResponse.Fail("Không có quyền bỏ phân ca tại cửa hàng này."));
        }
        else
        {
            if (EmployeeId == null)
                return BadRequest(ApiResponse.Fail("Tài khoản chưa liên kết nhân viên."));
            if (reg.EmployeeId != EmployeeId.Value)
                return StatusCode(403, ApiResponse.Fail("Không có quyền hủy đăng ký ca của nhân viên khác."));
            if (reg.Status != "Pending")
                return BadRequest(ApiResponse.Fail("Chỉ có thể hủy đăng ký đang chờ duyệt."));
        }

        if (isManager && dto != null
            && !string.IsNullOrWhiteSpace(dto.SliceStart) && !string.IsNullOrWhiteSpace(dto.SliceEnd)
            && TimeOnly.TryParse(dto.SliceStart, out var ss) && TimeOnly.TryParse(dto.SliceEnd, out var se))
        {
            var hourReg = await ShiftRegistrationSliceService.ResolveOrEnsureHourRegAsync(
                _db, reg, reg.EmployeeId, reg.StoreId, reg.WorkDate, ss, se);
            if (hourReg == null)
            {
                if (reg.Status is "Cancelled" or "Rejected")
                    return Ok(ApiResponse.Ok("Khung giờ này đã được bỏ trước đó."));
                return BadRequest(ApiResponse.Fail("Khung giờ không còn hoạt động. Tải lại lưới."));
            }
            reg = hourReg;
        }

        if (reg.Status is "Cancelled" or "Rejected")
            return Ok(ApiResponse.Ok(isManager ? "Khung giờ này đã được bỏ." : "Đăng ký đã hủy."));
        if (reg.Status is not ("Pending" or "Approved"))
            return BadRequest(ApiResponse.Fail("Không thể bỏ ca ở trạng thái này."));

        var dupes = await _db.ShiftRegistrations
            .Where(r => r.Id != reg.Id
                && r.EmployeeId == reg.EmployeeId
                && r.StoreId == reg.StoreId
                && r.WorkDate == reg.WorkDate
                && r.StartTime == reg.StartTime
                && r.EndTime == reg.EndTime
                && (r.Status == "Pending" || r.Status == "Approved"))
            .ToListAsync();

        reg.Status = "Cancelled";
        reg.ReviewedBy = CurrentUserId;
        reg.ReviewedAt = DateTime.UtcNow;
        foreach (var d in dupes)
        {
            d.Status = "Cancelled";
            d.ReviewedBy = CurrentUserId;
            d.ReviewedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok(isManager ? "Đã bỏ khung giờ này — các giờ khác giữ nguyên." : "Đã hủy đăng ký."));
    }

    private static string MapShiftRegistrationDbError(DbUpdateException ex)
    {
        var text = ex.InnerException?.Message ?? ex.Message;
        if (text.Contains("IX_ShiftRegistrations", StringComparison.OrdinalIgnoreCase)
            || text.Contains("duplicate", StringComparison.OrdinalIgnoreCase))
            return "Ca này đã được đăng ký trước đó (cùng ngày, cửa hàng và giờ). Mở lại ngày trên lịch để kiểm tra.";
        return text.Length <= 280 ? text : text[..280];
    }

    private async Task<ShiftRegistration?> FindTimeOverlapAsync(
        int employeeId, DateOnly workDate, TimeOnly start, TimeOnly end, int? excludeId)
    {
        var q = _db.ShiftRegistrations
            .Include(r => r.Store)
            .Where(r => r.EmployeeId == employeeId
                && r.WorkDate == workDate
                && (r.Status == "Pending" || r.Status == "Approved")
                && r.StartTime < end && start < r.EndTime);
        if (excludeId.HasValue)
            q = q.Where(r => r.Id != excludeId.Value);
        return await q.FirstOrDefaultAsync();
    }

    private static ShiftRegistrationDto MapDto(ShiftRegistration r)

    {

        var start = r.StartTime;

        var end = r.EndTime;

        var timeLabel = $"{start:HH\\:mm} – {end:HH\\:mm}";

        return new ShiftRegistrationDto

        {

            Id = r.Id,

            EmployeeId = r.EmployeeId,

            EmployeeName = r.Employee?.FullName ?? "",

            ShiftId = r.ShiftId,

            ShiftName = r.Shift?.Name ?? "",

            StartTime = start.ToString("HH:mm"),

            EndTime = end.ToString("HH:mm"),

            ShiftTime = timeLabel,

            StoreId = r.StoreId,

            StoreName = r.Store?.Name ?? "",

            WorkDate = r.WorkDate.ToString("yyyy-MM-dd"),

            Status = r.Status,

            RejectReason = r.RejectReason,

            CreatedAt = r.CreatedAt.ToString("yyyy-MM-dd HH:mm")

        };

    }

}


