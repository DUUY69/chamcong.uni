namespace WorkforceManagement.Api.Services;

/// <summary>Lưới QL duyệt theo giờ chẵn; NV có thể đăng ký giờ lẻ — giao với từng khung.</summary>
public static class ShiftTimeGrid
{
    public static TimeOnly FloorHour(TimeOnly t) => new(t.Hour, 0);

    public static TimeOnly CeilHour(TimeOnly t)
    {
        if (t.Minute == 0 && t.Second == 0 && t.Millisecond == 0) return t;
        return FloorHour(t).AddHours(1);
    }

    public static (TimeOnly Start, TimeOnly End) AlignToHourGrid(TimeOnly start, TimeOnly end)
    {
        var s = FloorHour(start);
        var e = CeilHour(end);
        if (e <= s) e = s.AddHours(1);
        return (s, e);
    }

    public static bool Overlaps(TimeOnly aStart, TimeOnly aEnd, TimeOnly bStart, TimeOnly bEnd) =>
        aStart < bEnd && bStart < aEnd;

    /** Giao NV đăng ký với khung QL duyệt (vd. 06:10–07:30 ∩ 06:00–07:00 → 06:10–07:00). */
    public static bool TryIntersect(
        TimeOnly aStart, TimeOnly aEnd, TimeOnly bStart, TimeOnly bEnd,
        out TimeOnly start, out TimeOnly end)
    {
        start = aStart > bStart ? aStart : bStart;
        end = aEnd < bEnd ? aEnd : bEnd;
        if (end <= start)
        {
            start = default;
            end = default;
            return false;
        }
        return true;
    }

    /** Ca NV vượt quá 1 khung giờ chẵn → cần tách slice theo giao thực tế. */
    public static bool SpansMultipleHourSlots(TimeOnly start, TimeOnly end) =>
        end > FloorHour(start).AddHours(1);

    public static IEnumerable<(TimeOnly Start, TimeOnly End)> IntersectWithHourSlots(TimeOnly regStart, TimeOnly regEnd)
    {
        var cur = FloorHour(regStart);
        var bound = CeilHour(regEnd);
        while (cur < bound)
        {
            var slotEnd = cur.AddHours(1);
            if (TryIntersect(regStart, regEnd, cur, slotEnd, out var s, out var e))
                yield return (s, e);
            cur = slotEnd;
        }
    }

    public static bool IsHourAligned(TimeOnly start, TimeOnly end) =>
        start.Minute == 0 && start.Second == 0
        && end.Minute == 0 && end.Second == 0
        && (end - start).TotalMinutes == 60;

    public static bool SameAlignedHourSlot(TimeOnly aStart, TimeOnly aEnd, TimeOnly bStart, TimeOnly bEnd)
    {
        var (as_, ae) = AlignToHourGrid(aStart, aEnd);
        var (bs, be) = AlignToHourGrid(bStart, bEnd);
        return as_ == bs && ae == be;
    }
}
