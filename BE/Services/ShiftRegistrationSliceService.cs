using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Models.Shift;

namespace WorkforceManagement.Api.Services;

public static class ShiftRegistrationSliceService
{
    public static bool IsMultiHour(TimeOnly start, TimeOnly end) =>
        (end - start).TotalMinutes > 60;

    public static bool OverlapsHourSlot(TimeOnly regStart, TimeOnly regEnd, TimeOnly slotStart, TimeOnly slotEnd) =>
        ShiftTimeGrid.Overlaps(regStart, regEnd, slotStart, slotEnd);

    public static bool ContainsSlice(TimeOnly regStart, TimeOnly regEnd, TimeOnly sliceStart, TimeOnly sliceEnd) =>
        sliceStart >= regStart && sliceEnd <= regEnd && sliceEnd > sliceStart;

    public static Task<ShiftRegistration?> FindSlotAsync(
        AppDbContext db, int employeeId, int storeId, DateOnly workDate, TimeOnly start, TimeOnly end) =>
        db.ShiftRegistrations.FirstOrDefaultAsync(r =>
            r.EmployeeId == employeeId && r.StoreId == storeId && r.WorkDate == workDate
            && r.StartTime == start && r.EndTime == end);

    /// <summary>Ca 1 khung Pending/Approved đúng giờ hoặc giao khung lưới QL.</summary>
    public static async Task<ShiftRegistration?> FindActiveHourRegAsync(
        AppDbContext db, int employeeId, int storeId, DateOnly workDate, TimeOnly slotStart, TimeOnly slotEnd)
    {
        var exact = await db.ShiftRegistrations
            .Where(r => r.EmployeeId == employeeId && r.StoreId == storeId && r.WorkDate == workDate
                && r.StartTime == slotStart && r.EndTime == slotEnd
                && (r.Status == "Pending" || r.Status == "Approved"))
            .OrderBy(r => r.Status == "Pending" ? 0 : 1)
            .ThenBy(r => r.Id)
            .FirstOrDefaultAsync();
        if (exact != null) return exact;

        var overlapping = await db.ShiftRegistrations
            .Where(r => r.EmployeeId == employeeId && r.StoreId == storeId && r.WorkDate == workDate
                && (r.Status == "Pending" || r.Status == "Approved")
                && r.StartTime < slotEnd && slotStart < r.EndTime)
            .OrderBy(r => r.Status == "Pending" ? 0 : 1)
            .ThenBy(r => r.StartTime)
            .ToListAsync();

        foreach (var r in overlapping)
        {
            if (!ShiftTimeGrid.TryIntersect(r.StartTime, r.EndTime, slotStart, slotEnd, out var isectStart, out var isectEnd))
                continue;
            if (r.StartTime == isectStart && r.EndTime == isectEnd)
                return r;
            var child = await FindSlotAsync(db, employeeId, storeId, workDate, isectStart, isectEnd);
            if (child != null && child.Status is "Pending" or "Approved")
                return child;
        }
        return null;
    }

    /// <summary>
    /// Tách ca NV theo giao thực tế với từng khung giờ chẵn.
    /// 06:10–07:30 → [06:10–07:00], [07:00–07:30] (không ép 06:00–07:00).
    /// </summary>
    public static async Task<List<ShiftRegistration>> SplitToHourlyAsync(AppDbContext db, ShiftRegistration reg)
    {
        var slices = ShiftTimeGrid.IntersectWithHourSlots(reg.StartTime, reg.EndTime).ToList();
        if (slices.Count <= 1)
        {
            var only = slices.FirstOrDefault();
            if (only.Start != default && (only.Start != reg.StartTime || only.End != reg.EndTime))
            {
                reg.StartTime = only.Start;
                reg.EndTime = only.End;
                await db.SaveChangesAsync();
            }
            return new List<ShiftRegistration> { reg };
        }

        var hourly = new List<ShiftRegistration>();
        foreach (var (sliceStart, sliceEnd) in slices)
        {
            var existing = await FindSlotAsync(db, reg.EmployeeId, reg.StoreId, reg.WorkDate, sliceStart, sliceEnd);
            if (existing != null)
            {
                if (existing.Id == reg.Id)
                    hourly.Add(existing);
                else if (existing.Status is "Cancelled" or "Rejected")
                {
                    existing.Status = reg.Status;
                    existing.ReviewedBy = reg.ReviewedBy;
                    existing.ReviewedAt = reg.ReviewedAt;
                    existing.RejectReason = null;
                    hourly.Add(existing);
                }
                else if (existing.Status is "Pending" or "Approved")
                    hourly.Add(existing);
            }
            else
            {
                hourly.Add(new ShiftRegistration
                {
                    EmployeeId = reg.EmployeeId,
                    ShiftId = reg.ShiftId,
                    StoreId = reg.StoreId,
                    WorkDate = reg.WorkDate,
                    StartTime = sliceStart,
                    EndTime = sliceEnd,
                    Status = reg.Status,
                    ReviewedBy = reg.ReviewedBy,
                    ReviewedAt = reg.ReviewedAt,
                    RejectReason = reg.RejectReason,
                });
            }
        }

        if (hourly.Count == 0)
            return new List<ShiftRegistration> { reg };

        foreach (var item in hourly.Where(h => h.Id == 0))
            db.ShiftRegistrations.Add(item);

        if (reg.Status is not ("Cancelled" or "Rejected"))
        {
            reg.Status = "Cancelled";
            reg.ReviewedAt = DateTime.UtcNow;
            reg.RejectReason = "Đã tách theo khung giờ";
        }
        await db.SaveChangesAsync();
        return hourly;
    }

    public static async Task<ShiftRegistration?> ResolveHourRegAsync(
        AppDbContext db, ShiftRegistration reg, TimeOnly slotStart, TimeOnly slotEnd)
    {
        var active = await FindActiveHourRegAsync(db, reg.EmployeeId, reg.StoreId, reg.WorkDate, slotStart, slotEnd);
        if (active != null) return active;

        if (reg.Status is "Cancelled" or "Rejected")
            return null;

        if (!OverlapsHourSlot(reg.StartTime, reg.EndTime, slotStart, slotEnd))
            return null;

        if (!ShiftTimeGrid.TryIntersect(reg.StartTime, reg.EndTime, slotStart, slotEnd, out var isectStart, out var isectEnd))
            return null;

        if (!IsMultiHour(reg.StartTime, reg.EndTime)
            && reg.StartTime == isectStart && reg.EndTime == isectEnd
            && reg.Status is "Pending" or "Approved")
            return reg;

        if (ShiftTimeGrid.SpansMultipleHourSlots(reg.StartTime, reg.EndTime) || IsMultiHour(reg.StartTime, reg.EndTime))
        {
            var parts = await SplitToHourlyAsync(db, reg);
            return parts.FirstOrDefault(h => h.StartTime == isectStart && h.EndTime == isectEnd)
                ?? await FindSlotAsync(db, reg.EmployeeId, reg.StoreId, reg.WorkDate, isectStart, isectEnd);
        }

        return reg;
    }

    public static async Task<ShiftRegistration?> ResolveOrEnsureHourRegAsync(
        AppDbContext db, ShiftRegistration? hint,
        int employeeId, int storeId, DateOnly workDate, TimeOnly slotStart, TimeOnly slotEnd)
    {
        var active = await FindActiveHourRegAsync(db, employeeId, storeId, workDate, slotStart, slotEnd);
        if (active != null) return active;

        if (hint != null)
        {
            var fromHint = await ResolveHourRegAsync(db, hint, slotStart, slotEnd);
            if (fromHint != null) return fromHint;
        }

        var parents = await db.ShiftRegistrations
            .Where(r => r.EmployeeId == employeeId && r.StoreId == storeId && r.WorkDate == workDate
                && (r.Status == "Pending" || r.Status == "Approved")
                && r.StartTime < slotEnd && slotStart < r.EndTime)
            .OrderBy(r => r.Status == "Pending" ? 0 : 1)
            .ThenBy(r => r.Id)
            .ToListAsync();

        foreach (var parent in parents)
        {
            var resolved = await ResolveHourRegAsync(db, parent, slotStart, slotEnd);
            if (resolved != null) return resolved;
        }

        foreach (var parent in parents)
        {
            if (!ShiftTimeGrid.TryIntersect(parent.StartTime, parent.EndTime, slotStart, slotEnd, out var gs, out var ge))
                continue;
            var ghost = await FindSlotAsync(db, employeeId, storeId, workDate, gs, ge);
            if (ghost != null && ghost.Status is "Cancelled" or "Rejected")
            {
                ghost.Status = "Pending";
                ghost.RejectReason = null;
                ghost.ReviewedAt = null;
                await db.SaveChangesAsync();
                return ghost;
            }
        }

        var gridGhost = await FindSlotAsync(db, employeeId, storeId, workDate, slotStart, slotEnd);
        if (gridGhost != null && gridGhost.Status is "Cancelled" or "Rejected")
        {
            gridGhost.Status = "Pending";
            gridGhost.RejectReason = null;
            gridGhost.ReviewedAt = null;
            await db.SaveChangesAsync();
            return gridGhost;
        }

        return null;
    }

    public static async Task<(bool ok, TimeOnly start, TimeOnly end, DateOnly workDate, string? err)> ParseHourSlot(
        HourSlotActionDto dto)
    {
        if (dto.EmployeeId <= 0 || dto.StoreId <= 0)
            return (false, default, default, default, "Thiếu nhân viên hoặc cửa hàng.");
        if (!DateOnly.TryParse(dto.WorkDate, out var workDate))
            return (false, default, default, default, "Ngày làm không hợp lệ (yyyy-MM-dd).");
        if (!TimeOnly.TryParse(dto.StartTime, out var start) || !TimeOnly.TryParse(dto.EndTime, out var end))
            return (false, default, default, default, "Giờ làm không hợp lệ (HH:mm).");
        if (end <= start)
            return (false, default, default, default, "Giờ kết thúc phải sau giờ bắt đầu.");
        return (true, start, end, workDate, null);
    }

    public static async Task<(bool moved, ShiftRegistration? target)> TryMoveOntoCancelledSlotAsync(
        AppDbContext db, ShiftRegistration source, int storeId, DateOnly workDate,
        TimeOnly start, TimeOnly end, int reviewerUserId)
    {
        var ghost = await FindSlotAsync(db, source.EmployeeId, storeId, workDate, start, end);
        if (ghost == null || ghost.Id == source.Id)
            return (false, null);

        if (ghost.Status is not ("Cancelled" or "Rejected"))
            return (false, ghost);

        ghost.Status = source.Status;
        ghost.ReviewedBy = source.ReviewedBy ?? reviewerUserId;
        ghost.ReviewedAt = DateTime.UtcNow;
        ghost.RejectReason = null;
        source.Status = "Cancelled";
        source.ReviewedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return (true, ghost);
    }

    public static Task<bool> HasHourlyChildrenAsync(AppDbContext db, ShiftRegistration reg) =>
        db.ShiftRegistrations.AnyAsync(r =>
            r.Id != reg.Id
            && r.EmployeeId == reg.EmployeeId
            && r.StoreId == reg.StoreId
            && r.WorkDate == reg.WorkDate
            && (r.Status == "Pending" || r.Status == "Approved")
            && r.StartTime >= reg.StartTime
            && r.EndTime <= reg.EndTime
            && !IsMultiHour(r.StartTime, r.EndTime));

    public static async Task<int> NormalizeLongShiftsAsync(AppDbContext db, IEnumerable<ShiftRegistration> regs)
    {
        var split = 0;
        foreach (var reg in regs.ToList())
        {
            if (reg.Status is not ("Pending" or "Approved")) continue;
            if (!ShiftTimeGrid.SpansMultipleHourSlots(reg.StartTime, reg.EndTime) && !IsMultiHour(reg.StartTime, reg.EndTime)) continue;
            if (await HasHourlyChildrenAsync(db, reg)) continue;
            try
            {
                await SplitToHourlyAsync(db, reg);
                split++;
            }
            catch (DbUpdateException) { }
        }
        return split;
    }

    /// <summary>Trả slice theo giao thực tế cho lưới QL — không ghi DB.</summary>
    public static List<ShiftRegistration> ExpandLongShiftsForDisplay(IEnumerable<ShiftRegistration> list)
    {
        var all = list.ToList();
        var active = all.Where(r => r.Status is "Pending" or "Approved").ToList();
        var result = new List<ShiftRegistration>();
        var seen = new HashSet<string>();

        string SlotKey(ShiftRegistration r) =>
            $"{r.EmployeeId}|{r.StoreId}|{r.WorkDate:yyyy-MM-dd}|{r.StartTime}|{r.EndTime}|{r.Status}";

        foreach (var r in active)
        {
            if (!ShiftTimeGrid.SpansMultipleHourSlots(r.StartTime, r.EndTime) && !IsMultiHour(r.StartTime, r.EndTime))
            {
                if (seen.Add(SlotKey(r))) result.Add(r);
                continue;
            }

            foreach (var (sliceStart, sliceEnd) in ShiftTimeGrid.IntersectWithHourSlots(r.StartTime, r.EndTime))
            {
                var exact = active.FirstOrDefault(x =>
                    x.EmployeeId == r.EmployeeId && x.StoreId == r.StoreId && x.WorkDate == r.WorkDate
                    && x.StartTime == sliceStart && x.EndTime == sliceEnd);

                if (exact != null)
                {
                    if (seen.Add(SlotKey(exact))) result.Add(exact);
                    continue;
                }

                var slice = new ShiftRegistration
                {
                    Id = r.Id,
                    EmployeeId = r.EmployeeId,
                    Employee = r.Employee,
                    StoreId = r.StoreId,
                    Store = r.Store,
                    ShiftId = r.ShiftId,
                    Shift = r.Shift,
                    WorkDate = r.WorkDate,
                    StartTime = sliceStart,
                    EndTime = sliceEnd,
                    Status = r.Status,
                    RejectReason = r.RejectReason,
                    ReviewedBy = r.ReviewedBy,
                    ReviewedAt = r.ReviewedAt,
                    CreatedAt = r.CreatedAt,
                };
                if (seen.Add(SlotKey(slice))) result.Add(slice);
            }
        }

        foreach (var r in all.Where(r => r.Status is not ("Pending" or "Approved")))
            result.Add(r);

        return result.OrderByDescending(r => r.WorkDate).ThenBy(r => r.StartTime).ToList();
    }
}
