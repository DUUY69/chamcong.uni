import { sortShiftsPendingFirst } from "@/utils/shiftFormat";

/** Ca mặc định khi API shift-templates lỗi/trống — vẫn expand theo giờ. */
export const DEFAULT_SHIFT_TEMPLATES = [
  { id: 1, name: "Ca sáng", startTime: "06:00", endTime: "14:00", colorHex: "#2563eb" },
  { id: 2, name: "Ca chiều", startTime: "14:00", endTime: "22:00", colorHex: "#7c3aed" },
];

/** Ca chuẩn mặc định — dùng khi chưa load được ShiftTemplates từ API. */
export const SHIFT_SLOTS = [
  { id: "morning", label: "Ca sáng", sub: "06:00 – 14:00", start: "06:00", end: "14:00" },
  { id: "afternoon", label: "Ca chiều", sub: "14:00 – 22:00", start: "14:00", end: "22:00" },
];

/** Chuyển ShiftTemplate từ API thành định dạng SHIFT_SLOTS. */
export function templatesAsSlots(templates) {
  if (!templates || templates.length === 0) return SHIFT_SLOTS;
  return templates.map((t) => ({
    id: String(t.id),
    label: t.name,
    sub: `${t.startTime} – ${t.endTime}`,
    start: t.startTime,
    end: t.endTime,
    colorHex: t.colorHex,
  }));
}

/**
 * Expand một ca lớn thành các slot 1 giờ.
 * VD: Ca sáng 06:00-14:00 → [{id:"t1_0600", label:"Ca sáng · 06:00", start:"06:00", end:"07:00"}, ...]
 */
export function expandTemplateToHourSlots(template) {
  const slots = [];
  let cur = parseMinutes(template.startTime ?? template.start);
  const end = parseMinutes(template.endTime ?? template.end);
  let idx = 0;
  while (cur < end) {
    const next = Math.min(cur + 60, end);
    const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    slots.push({
      id: `t${template.id ?? template.start}_${fmt(cur).replace(":", "")}`,
      label: template.name ?? template.label,
      sub: `${fmt(cur)} – ${fmt(next)}`,
      start: fmt(cur),
      end: fmt(next),
      colorHex: template.colorHex,
      parentLabel: template.name ?? template.label,
      isFirstInParent: idx === 0,
      isLastInParent: next >= end,
      parentStart: template.startTime ?? template.start,
      parentEnd: template.endTime ?? template.end,
    });
    cur = next;
    idx++;
  }
  return slots;
}

/**
 * Chuyển danh sách ShiftTemplates thành tất cả slots theo giờ (expand).
 * Fallback về SHIFT_SLOTS nếu không có templates.
 */
export function templatesAsHourSlots(templates) {
  if (!templates || templates.length === 0) return SHIFT_SLOTS;
  return templates.flatMap((t) => expandTemplateToHourSlots(t));
}

/** Ca full ngày — hiển thị trên cả 2 slot lưới phân ca. */
export const FULL_DAY_SHIFT = {
  id: "fullday",
  label: "Ca full ngày",
  sub: "08:00 – 17:00",
  start: "08:00",
  end: "17:00",
};

export const REGISTRATION_SHIFT_OPTIONS = [...SHIFT_SLOTS, FULL_DAY_SHIFT];

function parseMinutes(t) {
  const [h, m] = String(t || "00:00").slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatMinutes(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Chuẩn hóa giờ đăng ký về lưới tròn (06:00–07:00, không 06:30–07:30). */
export function snapToHourGrid(startTime, endTime) {
  const sm = parseMinutes(startTime);
  const em = parseMinutes(endTime);
  const start = Math.floor(sm / 60) * 60;
  let end = em % 60 === 0 ? em : (Math.floor(em / 60) + 1) * 60;
  if (end <= start) end = start + 60;
  return { startTime: formatMinutes(start), endTime: formatMinutes(end) };
}

/** Đăng ký có giao với khung ca không. */
export function regOverlapsSlot(r, slotId, slots = SHIFT_SLOTS) {
  const slot = slots.find((s) => s.id === slotId);
  if (!slot || !r?.startTime || !r?.endTime) return false;
  const rs = parseMinutes(r.startTime);
  const re = parseMinutes(r.endTime);
  const ss = parseMinutes(slot.start);
  const se = parseMinutes(slot.end);
  return rs < se && ss < re;
}

/** Một đăng ký có thể thuộc 1 hoặc nhiều ca. */
export function slotsForReg(r, slots = SHIFT_SLOTS) {
  return slots.filter((s) => regOverlapsSlot(r, s.id, slots)).map((s) => s.id);
}

export function slotForReg(r, slots = SHIFT_SLOTS) {
  const found = slotsForReg(r, slots);
  if (found.length > 0) return found[0];
  const start = (r.startTime || "").slice(0, 5);
  const h = parseInt(start.split(":")[0], 10);
  if (Number.isNaN(h) || h < 14) return slots[0]?.id ?? "morning";
  return slots[1]?.id ?? "afternoon";
}

function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getMondayOfWeek(refDate = new Date()) {
  const d = new Date(refDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toLocalDateStr(d);
}

export function getWeekDates(mondayStr) {
  const base = new Date(`${mondayStr}T12:00:00`);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(base);
    x.setDate(base.getDate() + i);
    dates.push(toLocalDateStr(x));
  }
  return dates;
}

export function getTwoWeekDates(mondayStr) {
  return [...getWeekDates(mondayStr), ...getWeekDates(addDays(mondayStr, 7))];
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toLocalDateStr(d);
}

export function localTodayStr() {
  return toLocalDateStr(new Date());
}

export function formatViDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Chỉ chặn hôm nay và quá khứ — không giới hạn ngày xa. */
export function getEmployeeDayBlockReason(dateStr, { todayStr = localTodayStr() } = {}) {
  if (dateStr <= todayStr) {
    if (dateStr === todayStr) return "Không đăng ký ca cho hôm nay — chỉ từ ngày mai.";
    return "Không đăng ký ca cho ngày đã qua.";
  }
  return null;
}

export function getRegistrationWindowHint() {
  const tomorrow = formatViDate(addDays(localTodayStr(), 1));
  return `Đăng ký ca từ ${tomorrow} trở đi — không giới hạn số ngày xa.`;
}

export function validateShiftRegistrationDate(dateStr, storeId, stores = []) {
  const block = getEmployeeDayBlockReason(dateStr);
  if (block) return block;
  if (!storeId) return "Vui lòng chọn cửa hàng.";
  if (!stores.find((s) => String(s.id) === String(storeId))) return "Vui lòng chọn cửa hàng.";
  return null;
}

export function defaultShiftFormForDate(stores, primaryStoreId) {
  const preferred =
    primaryStoreId != null && Number(primaryStoreId) > 0 ? String(primaryStoreId) : "";
  const inList = stores.some((s) => String(s.id) === preferred);
  const storeId =
    preferred && inList ? preferred : stores.length >= 1 ? String(stores[0].id) : "";
  return { storeId, startTime: "06:00", endTime: "14:00", customTime: false };
}

/** CH chính lên đầu dropdown đăng ký ca. */
export function sortStoresPrimaryFirst(stores, primaryStoreId) {
  if (!stores?.length) return [];
  const pid =
    primaryStoreId != null && Number(primaryStoreId) > 0 ? String(primaryStoreId) : "";
  return [...stores].sort((a, b) => {
    if (pid && String(a.id) === pid) return -1;
    if (pid && String(b.id) === pid) return 1;
    return String(a.name || "").localeCompare(String(b.name || ""), "vi");
  });
}

export function extractApiError(err, fallback = "Có lỗi xảy ra. Vui lòng thử lại.") {
  return err?.response?.data?.message || err?.response?.data?.error || fallback;
}

export function formatRangeLabel(dates) {
  if (!dates.length) return "";
  const fmt = (s) => new Date(`${s}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
}

const DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function weekdayLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = d.getDay();
  return DOW[dow === 0 ? 6 : dow - 1];
}

export function dayMonthLabel(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

/** VD: Thứ Sáu, 06/06/2026 */
export function formatDayTitle(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const weekday = d.toLocaleDateString("vi-VN", { weekday: "long" });
  const label = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const rest = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${label}, ${rest}`;
}

function normTime(t) {
  return String(t || "").slice(0, 5);
}

function isMultiHourReg(r) {
  return parseMinutes(r.endTime) - parseMinutes(r.startTime) > 60;
}

/** Cùng NV trong một ô lưới (lưới giờ: mỗi ô tối đa 1 chip / NV). */
function isSameCellEntry(a, b, oneEmployeePerSlot = false) {
  if (a.employeeId !== b.employeeId) return false;
  if (Number(a.storeId) !== Number(b.storeId)) return false;
  if (a.workDate?.slice(0, 10) !== b.workDate?.slice(0, 10)) return false;
  if (oneEmployeePerSlot) return true;
  return normTime(a.startTime) === normTime(b.startTime)
    && normTime(a.endTime) === normTime(b.endTime);
}

function hasExactHourReg(regs, r, hourStart, hourEnd) {
  return findExactHourReg(regs, r, hourStart, hourEnd) != null;
}

/** Bản ghi 1 giờ thật trong DB — dùng id này khi duyệt/hủy (tránh id ca dài trên chip). */
export function findExactHourReg(regs, reg, hourStart, hourEnd) {
  const hs = normTime(hourStart);
  const he = normTime(hourEnd);
  const d = reg.workDate?.slice(0, 10);
  const matches = (regs || []).filter((other) => {
    if (other.employeeId !== reg.employeeId) return false;
    if (other.workDate?.slice(0, 10) !== d) return false;
    if (Number(other.storeId) !== Number(reg.storeId)) return false;
    if (other.status !== "Pending" && other.status !== "Approved") return false;
    return normTime(other.startTime) === hs && normTime(other.endTime) === he;
  });
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    if (a.status === "Pending" && b.status !== "Pending") return -1;
    if (b.status === "Pending" && a.status !== "Pending") return 1;
    return a.id - b.id;
  });
  return matches[0];
}

/** Payload duyệt/hủy theo ô giờ — không dùng id chip. */
export function buildHourSlotPayload(reg, slot) {
  const { start, end } = getShiftTimesForDropSlot(slot, reg);
  return {
    employeeId: reg.employeeId,
    storeId: Number(reg.storeId),
    workDate: reg.workDate?.slice(0, 10),
    startTime: start,
    endTime: end,
  };
}

function pushToCell(cell, entry, opts = {}) {
  const onePer = opts.oneEmployeePerSlot === true;
  const dup = cell.some((x) => isSameCellEntry(x, entry, onePer));
  if (dup) return;
  cell.push(entry);
}

/** Nhóm ca theo ngày + ca động. Lưới theo giờ: mỗi ô chỉ hiện đúng khung giờ đó. */
export function buildScheduleGrid(regs, dates, slots = SHIFT_SLOTS) {
  const active = (regs || []).filter((r) => r.status === "Pending" || r.status === "Approved");
  const emptyDay = () => Object.fromEntries(slots.map((s) => [s.id, []]));
  const isHourGrid = slots.some((s) => s.parentStart != null);
  const cellOpts = isHourGrid ? { oneEmployeePerSlot: true } : {};
  const grid = {};
  for (const d of dates) {
    grid[d] = emptyDay();
  }

  // Pass 1: ca 1 giờ (hoặc ca ngắn) — bản ghi thật từ DB, ưu tiên hiển thị
  for (const r of active) {
    const d = r.workDate?.slice(0, 10);
    if (!grid[d]) continue;
    if (isHourGrid && isMultiHourReg(r)) continue;

    for (const slotId of slotsForReg(r, slots)) {
      if (grid[d][slotId]) pushToCell(grid[d][slotId], r, cellOpts);
    }
  }

  // Pass 2: ca dài → tách ảo theo giờ, chỉ khi chưa có bản ghi 1 giờ tương ứng
  for (const r of active) {
    const d = r.workDate?.slice(0, 10);
    if (!grid[d]) continue;
    if (!isHourGrid || !isMultiHourReg(r)) continue;

    for (const slot of slots) {
      if (!regOverlapsSlot(r, slot.id, slots)) continue;
      const { start, end } = getShiftTimesForDropSlot(slot, r);
      if (hasExactHourReg(active, r, start, end)) continue;
      if (cellOpts.oneEmployeePerSlot && grid[d][slot.id].some((x) => x.employeeId === r.employeeId)) continue;
      const exact = findExactHourReg(active, r, start, end);
      const sliceEntry = {
        ...r,
        id: exact?.id ?? r.id,
        startTime: start,
        endTime: end,
        status: exact?.status ?? r.status,
        _hourSlice: !exact,
        _apiRegId: exact?.id ?? r.id,
      };
      pushToCell(grid[d][slot.id], sliceEntry, cellOpts);
    }
  }

  for (const d of dates) {
    for (const slot of slots) {
      if (grid[d][slot.id]) grid[d][slot.id] = sortShiftsPendingFirst(grid[d][slot.id]);
    }
  }
  return grid;
}

export function employeeInitials(name = "") {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

export const MAX_STAFF_PER_SLOT = 4;

export function countActiveInSlot(regs, storeId, dateStr, slotId, excludeRegId = null, approvedOnly = false, slots = SHIFT_SLOTS) {
  const slot = slots.find((s) => s.id === slotId);
  if (!slot || !storeId || !dateStr) return 0;
  const sid = Number(storeId);
  return (regs || []).filter((r) => {
    if (excludeRegId != null && r.id === excludeRegId) return false;
    if (approvedOnly && r.status !== "Approved") return false;
    if (!approvedOnly && r.status !== "Pending" && r.status !== "Approved") return false;
    return Number(r.storeId) === sid
      && r.workDate?.slice(0, 10) === dateStr
      && regOverlapsSlot(r, slotId, slots);
  }).length;
}

export function isSlotOverCapacity(regs, storeId, dateStr, slotId, excludeRegId = null, approvedOnly = false, slots = SHIFT_SLOTS) {
  return countActiveInSlot(regs, storeId, dateStr, slotId, excludeRegId, approvedOnly, slots) > MAX_STAFF_PER_SLOT;
}

/** Ngày NV đã có đăng ký Pending/Approved. */
export function getEmployeeRegisteredDates(regs, employeeId) {
  const set = new Set();
  for (const r of regs || []) {
    if (r.employeeId !== employeeId) continue;
    if (r.status !== "Pending" && r.status !== "Approved") continue;
    const d = r.workDate?.slice(0, 10);
    if (d) set.add(d);
  }
  return set;
}

/**
 * Giờ áp dụng khi thả vào ô lưới.
 * Lưới chia theo giờ → chỉ gán đúng 1 khung giờ ô đó (VD 10:00–11:00).
 * Lưới ca lớn (sáng/chiều) → giữ nguyên khung ca.
 */
export function getShiftTimesForDropSlot(slot, dragReg) {
  if (!slot) {
    return {
      start: (dragReg?.startTime || "06:00").slice(0, 5),
      end: (dragReg?.endTime || "07:00").slice(0, 5),
    };
  }
  if (slot.parentStart != null) {
    return {
      start: slot.start.slice(0, 5),
      end: slot.end.slice(0, 5),
    };
  }
  return {
    start: slot.start.slice(0, 5),
    end: slot.end.slice(0, 5),
  };
}

function hasTimeOverlapOnDate(regs, employeeId, dateStr, start, end, excludeRegId = null) {
  const rs = parseMinutes(start);
  const re = parseMinutes(end);
  return (regs || []).some((r) => {
    if (excludeRegId != null && r.id === excludeRegId) return false;
    if (r.employeeId !== employeeId) return false;
    if (r.workDate?.slice(0, 10) !== dateStr) return false;
    if (r.status !== "Pending" && r.status !== "Approved") return false;
    return parseMinutes(r.startTime) < re && rs < parseMinutes(r.endTime);
  });
}

/** Tìm đăng ký của NV trên ngày đích (Pending/Approved). */
export function findEmployeeRegOnDate(regs, employeeId, dateStr) {
  const list = (regs || []).filter(
    (r) =>
      r.employeeId === employeeId
      && r.workDate?.slice(0, 10) === dateStr
      && (r.status === "Pending" || r.status === "Approved")
  );
  if (list.length === 0) return null;
  list.sort((a, b) => {
    if (a.status === "Pending" && b.status !== "Pending") return -1;
    if (b.status === "Pending" && a.status !== "Pending") return 1;
    return 0;
  });
  return list[0];
}

/** Khối ca cha (CA SÁNG / CA CHIỀU) — dùng giới hạn phân ca. */
export function getSlotParentKey(slot) {
  if (!slot) return "";
  if (slot.parentStart != null && slot.parentEnd != null) {
    return `${slot.parentStart}-${slot.parentEnd}`;
  }
  return `${slot.start}-${slot.end}`;
}

/** Chuẩn hóa pick từ lưới: { reg, sliceStart, sliceEnd } hoặc reg thuần. */
export function normalizePickedReg(picked) {
  if (!picked) return null;
  if (picked.reg) return picked;
  return { reg: picked, sliceStart: null, sliceEnd: null };
}

/** Ô đích có thể thả NV không. */
export function canDropRegOnCell(regs, picked, targetDate, slotId, slots = SHIFT_SLOTS) {
  const pick = normalizePickedReg(picked);
  const dragReg = pick?.reg;
  if (!dragReg || !targetDate || !slotId) return false;
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return false;

  // Chỉ đổi giờ trong cùng khối ca (sáng ↔ chiều không cho trộn)
  if (pick.parentStart && pick.parentEnd && slot.parentStart != null) {
    if (pick.parentStart !== slot.parentStart || pick.parentEnd !== slot.parentEnd) {
      return false;
    }
  }

  const srcDate = dragReg.workDate?.slice(0, 10);
  const { start, end } = getShiftTimesForDropSlot(slot, dragReg);

  if (srcDate !== targetDate) {
    const registeredDates = getEmployeeRegisteredDates(regs, dragReg.employeeId);
    if (!registeredDates.has(targetDate)) return false;
  }

  if (srcDate === targetDate) {
    if (pick.sliceStart && pick.sliceEnd) {
      if (pick.sliceStart === start && pick.sliceEnd === end) return false;
    } else if (regOverlapsSlot(dragReg, slotId, slots)) {
      return false;
    }
    return !hasTimeOverlapOnDate(regs, dragReg.employeeId, targetDate, start, end, dragReg.id);
  }

  return !hasTimeOverlapOnDate(regs, dragReg.employeeId, targetDate, start, end, dragReg.id);
}

/** Đăng ký có nằm trong khối ca cha (CA SÁNG / CA CHIỀU) của ô lưới không. */
export function regOverlapsParentBlock(r, slot) {
  if (!slot || !r?.startTime || !r?.endTime) return false;
  const ps = parseMinutes(slot.parentStart ?? slot.start);
  const pe = parseMinutes(slot.parentEnd ?? slot.end);
  const rs = parseMinutes(r.startTime);
  const re = parseMinutes(r.endTime);
  return rs < pe && ps < re;
}

/**
 * NV đã đăng ký cùng khối ca (sáng/chiều) trong ngày, chưa có giờ trùng ô đích.
 */
export function getAssignCandidates(regs, dateStr, slotId, storeId, slots = SHIFT_SLOTS) {
  const slot = slots.find((s) => s.id === slotId);
  if (!slot || !dateStr || !storeId) return [];
  const sid = Number(storeId);
  const slotStart = parseMinutes(slot.start);
  const slotEnd = parseMinutes(slot.end);
  const parentLabel = slot.parentLabel || slot.label || "";

  const byEmployee = new Map();
  for (const r of regs || []) {
    if (r.workDate?.slice(0, 10) !== dateStr) continue;
    if (Number(r.storeId) !== sid) continue;
    if (r.status !== "Pending" && r.status !== "Approved") continue;
    if (!regOverlapsParentBlock(r, slot)) continue;
    const key = r.employeeId;
    if (!byEmployee.has(key)) {
      byEmployee.set(key, {
        employeeId: key,
        employeeName: r.employeeName,
        hours: [],
        parentLabel,
      });
    }
    byEmployee.get(key).hours.push(r);
  }

  const out = [];
  for (const info of byEmployee.values()) {
    const coversSlot = info.hours.some((r) => {
      const rs = parseMinutes(r.startTime);
      const re = parseMinutes(r.endTime);
      return rs <= slotStart && re >= slotEnd;
    });
    if (coversSlot) continue;

    const overlapsSlot = info.hours.some((r) => {
      const rs = parseMinutes(r.startTime);
      const re = parseMinutes(r.endTime);
      return rs < slotEnd && slotStart < re;
    });
    if (overlapsSlot) continue;

    const pendingCount = info.hours.filter((h) => h.status === "Pending").length;
    out.push({
      employeeId: info.employeeId,
      employeeName: info.employeeName,
      regCount: info.hours.length,
      pendingCount,
      parentLabel: info.parentLabel,
    });
  }
  return out.sort((a, b) => String(a.employeeName).localeCompare(String(b.employeeName), "vi"));
}

/**
 * QL chọn NV cửa hàng để phân giờ — kể cả NV chưa tự đăng ký khối ca đó.
 */
export function getManagerAssignCandidates(storeStaff, regs, dateStr, slotId, storeId, slots = SHIFT_SLOTS, overlapRegs = null) {
  const slot = slots.find((s) => s.id === slotId);
  if (!slot || !dateStr || !storeId) return [];
  const sid = Number(storeId);
  const { start, end } = getShiftTimesForDropSlot(slot, {});
  const slotStart = parseMinutes(start);
  const slotEnd = parseMinutes(end);
  const overlapSource = overlapRegs ?? regs;

  const out = [];
  for (const emp of storeStaff || []) {
    if (emp.isActive === false) continue;
    const employeeId = emp.id ?? emp.employeeId;
    if (!employeeId) continue;
    const employeeName = emp.fullName ?? emp.employeeName ?? emp.name ?? "";

    const dayEmpRegs = (regs || []).filter((r) =>
      r.workDate?.slice(0, 10) === dateStr
      && Number(r.storeId) === sid
      && Number(r.employeeId) === Number(employeeId)
      && (r.status === "Pending" || r.status === "Approved")
    );

    const dayAllRegs = (overlapSource || []).filter((r) =>
      r.workDate?.slice(0, 10) === dateStr
      && Number(r.employeeId) === Number(employeeId)
      && (r.status === "Pending" || r.status === "Approved")
    );

    const coversSlot = dayAllRegs.some((r) => {
      const rs = parseMinutes(r.startTime);
      const re = parseMinutes(r.endTime);
      return rs <= slotStart && re >= slotEnd;
    });
    if (coversSlot) continue;

    const overlapsSlot = dayAllRegs.some((r) => {
      const rs = parseMinutes(r.startTime);
      const re = parseMinutes(r.endTime);
      return rs < slotEnd && slotStart < re;
    });
    if (overlapsSlot) continue;

    out.push({
      employeeId,
      employeeName,
      regCount: dayEmpRegs.length,
      pendingCount: dayEmpRegs.filter((r) => r.status === "Pending").length,
      hasSelfRegistered: dayEmpRegs.length > 0,
      parentLabel: slot.parentLabel || slot.label || "",
    });
  }
  return out.sort((a, b) => String(a.employeeName).localeCompare(String(b.employeeName), "vi"));
}

/** Tập ô hợp lệ khi chọn NV. Key: `yyyy-MM-dd-slotId`. */
export function getValidDropCellKeys(regs, picked, dates, slots = SHIFT_SLOTS) {
  const keys = new Set();
  const pick = normalizePickedReg(picked);
  if (!pick?.reg || !dates?.length) return keys;
  for (const d of dates) {
    for (const slot of slots) {
      if (canDropRegOnCell(regs, pick, d, slot.id, slots)) {
        keys.add(`${d}-${slot.id}`);
      }
    }
  }
  return keys;
}
