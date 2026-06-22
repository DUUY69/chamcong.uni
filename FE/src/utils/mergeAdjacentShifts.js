function parseMinutes(t) {
  const [h, m] = String(t || "00:00").slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function normTime(t) {
  return String(t || "").slice(0, 5);
}

function groupKey(s) {
  const workDate = (s.workDate || "").slice(0, 10);
  const storeId = s.storeId != null && s.storeId !== "" ? String(s.storeId) : "";
  const employeeId = s.employeeId != null && s.employeeId !== "" ? String(s.employeeId) : "";
  return `${storeId}|${employeeId}|${workDate}|${s.status || ""}`;
}

function sliceKey(s) {
  return `${s.id}|${normTime(s.startTime)}|${normTime(s.endTime)}`;
}

/** Liền kề: giờ ra ca trước = giờ vào ca sau (07:00–08:00 + 08:00–09:00). */
function isStrictlyAdjacent(prevEnd, nextStart) {
  return parseMinutes(nextStart) === parseMinutes(prevEnd);
}

/**
 * Chỉ gộp HIỂN THỊ khi ca liền kề (không gộp ca cách giờ / trùng giờ).
 * 06:37–07:00 + 07:00–08:00 → 06:37–08:00
 * 06:37–07:00 và 02:13–20:11 → 2 dòng riêng
 */
export function mergeAdjacentShifts(shifts = []) {
  if (!shifts.length) return [];

  const groups = new Map();
  for (const s of shifts) {
    const key = groupKey(s);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  const blocks = [];
  for (const items of groups.values()) {
    const sorted = [...items].sort((a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime));
    let cur = null;

    for (const s of sorted) {
      const start = normTime(s.startTime);
      const end = normTime(s.endTime);
      const workDate = (s.workDate || "").slice(0, 10);
      const sk = sliceKey(s);

      if (!cur || !isStrictlyAdjacent(cur.endTime, start)) {
        cur = {
          ...s,
          id: s.id,
          workDate,
          registrationIds: [s.id],
          _sliceKeys: new Set([sk]),
          startTime: start,
          endTime: end,
          shiftTime: undefined,
        };
        blocks.push(cur);
        continue;
      }

      if (!cur._sliceKeys.has(sk)) {
        cur._sliceKeys.add(sk);
        if (!cur.registrationIds.includes(s.id)) cur.registrationIds.push(s.id);
      }
      if (parseMinutes(end) > parseMinutes(cur.endTime)) cur.endTime = end;
      cur.shiftTime = undefined;
    }
  }

  return blocks
    .map(({ _sliceKeys, ...block }) => block)
    .sort((a, b) => {
      const d = (a.workDate || "").localeCompare(b.workDate || "");
      if (d !== 0) return d;
      const store = Number(a.storeId) - Number(b.storeId);
      if (store !== 0) return store;
      return parseMinutes(a.startTime) - parseMinutes(b.startTime);
    });
}

export function attendanceForShiftBlock(attendances, block) {
  const ids = new Set(block.registrationIds || [block.id]);
  return (attendances || []).find((a) => ids.has(a.shiftRegistrationId));
}

/** Gộp dòng manager-day-board liền giờ (06-07 + 07-08 → 06-08). */
export function mergeDayBoardRows(rows = []) {
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => {
    const emp = (a.employeeName || "").localeCompare(b.employeeName || "", "vi");
    if (emp !== 0) return emp;
    const store = (a.storeName || "").localeCompare(b.storeName || "", "vi");
    if (store !== 0) return store;
    return parseMinutes(a.scheduledStart) - parseMinutes(b.scheduledStart);
  });

  const blocks = [];
  let cur = null;

  for (const r of sorted) {
    const start = normTime(r.scheduledStart);
    const end = normTime(r.scheduledEnd);
    const attKey = r.attendanceId ?? null;
    const canMerge = cur
      && cur.employeeId === r.employeeId
      && cur.storeId === r.storeId
      && cur.scheduledEnd === start
      && (cur.attendanceId ?? null) === attKey
      && cur.punchStatus === r.punchStatus;

    if (!canMerge) {
      cur = {
        ...r,
        scheduledStart: start,
        scheduledEnd: end,
      };
      blocks.push(cur);
      continue;
    }
    cur.scheduledEnd = end;
  }

  return blocks;
}
