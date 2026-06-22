import { useMemo, useState, useEffect } from "react";
import { Typography } from "@material-tailwind/react";
import { ChevronLeftIcon, ChevronRightIcon, Bars3Icon, XMarkIcon, CheckIcon } from "@heroicons/react/24/solid";
import api from "@/api";
import {
  SHIFT_SLOTS,
  templatesAsSlots,
  templatesAsHourSlots,
  buildScheduleGrid,
  canDropRegOnCell,
  dayMonthLabel,
  employeeInitials,
  formatRangeLabel,
  getManagerAssignCandidates,
  getValidDropCellKeys,
  getWeekDates,
  addDays,
  getMondayOfWeek,
  countActiveInSlot,
  isSlotOverCapacity,
  MAX_STAFF_PER_SLOT,
  getShiftTimesForDropSlot,
  buildHourSlotPayload,
  weekdayLabel,
  localTodayStr,
  DEFAULT_SHIFT_TEMPLATES,
} from "@/utils/scheduleSlots";
import ScheduleStatsBar, { computeScheduleStats } from "@/components/ScheduleStatsBar";
import DayLaborSummaryStrip from "@/components/DayLaborSummaryStrip";
import { buildEmployeeDisplayNameResolver } from "@/utils/scheduleDisplayNames";
import { isRegApproved, scheduleCellTone } from "@/utils/scheduleStatusColors";

function RegChip({
  reg, displayName, slot, selected, pickMode, onPick, onApprove, onUnassign,
  onDragStart, onDragEnd, draggable, readOnly, cellReadOnly,
}) {
  const approved = isRegApproved(reg);
  const tone = scheduleCellTone(reg);
  const locked = readOnly || cellReadOnly;
  const canInteract = !locked && (draggable || pickMode);
  const name = displayName || reg.employeeName?.split(" ").pop() || reg.employeeName;
  const hourHint = reg._hourSlice && reg.startTime && reg.endTime
    ? `${String(reg.startTime).slice(0, 5)}–${String(reg.endTime).slice(0, 5)}`
    : null;

  return (
    <div
      draggable={canInteract && draggable}
      onDragStart={(e) => {
        if (!draggable || locked) return;
        e.stopPropagation();
        e.dataTransfer.setData("application/json", JSON.stringify({ regId: reg.id }));
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(reg, slot);
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        onDragEnd?.();
      }}
      title={`${reg.employeeName} · ${(reg.startTime || "").slice(0, 5)}–${(reg.endTime || "").slice(0, 5)}${approved ? " · đã duyệt" : " · chờ xử lý"}`}
      style={selected ? undefined : tone.style}
      className={`w-full flex items-center gap-1 rounded-md px-1 py-1 text-[10px] sm:text-xs border-2 transition-all touch-manipulation select-none ${
        selected
          ? "ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50 text-indigo-900"
          : tone.className
      } ${canInteract && draggable ? "cursor-grab active:cursor-grabbing" : locked ? "cursor-default" : "cursor-pointer"}`}
    >
      {!locked && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPick?.(reg, slot); }}
          className={`shrink-0 p-0.5 rounded touch-manipulation ${selected ? "text-indigo-200" : "text-white/80"}`}
          aria-label="Kéo / chọn"
        >
          <Bars3Icon className="w-3.5 h-3.5" />
        </button>
      )}
      <span className={`flex-1 min-w-0 truncate font-semibold px-1.5 py-0.5 rounded ${
        selected ? "bg-indigo-100" : "bg-black/15"
      }`}>
        {name}
        {hourHint ? <span className="font-normal opacity-90"> · {hourHint}</span> : null}
      </span>
      {!locked && !approved && onApprove ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onApprove?.(reg, slot); }}
          className="shrink-0 p-0.5 rounded text-white hover:bg-white/25 touch-manipulation"
          title="Duyệt"
        >
          <CheckIcon className="w-3.5 h-3.5" />
        </button>
      ) : null}
      {!locked && onUnassign ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onUnassign?.(reg, slot); }}
          className="shrink-0 p-0.5 rounded text-white hover:bg-white/25 touch-manipulation"
          title="Bỏ"
        >
          <XMarkIcon className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function AssignSlotPanel({
  open, dateStr, slot, storeId, registrations, activeSlots, onClose, onAssigned,
}) {
  const [assigning, setAssigning] = useState(false);
  const [storeStaff, setStoreStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [dayOverlapRegs, setDayOverlapRegs] = useState([]);

  useEffect(() => {
    if (!open || !storeId) {
      setStoreStaff([]);
      return;
    }
    let cancelled = false;
    setStaffLoading(true);
    api.get(`/stores/${storeId}/employees`)
      .then((r) => { if (!cancelled) setStoreStaff(r.data?.data || []); })
      .catch(() => { if (!cancelled) setStoreStaff([]); })
      .finally(() => { if (!cancelled) setStaffLoading(false); });
    return () => { cancelled = true; };
  }, [open, storeId]);

  useEffect(() => {
    if (!open || !dateStr) {
      setDayOverlapRegs([]);
      return;
    }
    let cancelled = false;
    api.get(`/shift-registrations?dateFrom=${dateStr}&dateTo=${dateStr}`)
      .then((r) => { if (!cancelled) setDayOverlapRegs(r.data?.data || []); })
      .catch(() => { if (!cancelled) setDayOverlapRegs([]); });
    return () => { cancelled = true; };
  }, [open, dateStr]);

  const candidates = useMemo(
    () => (open && slot
      ? getManagerAssignCandidates(
        storeStaff, registrations, dateStr, slot.id, storeId, activeSlots, dayOverlapRegs
      )
      : []),
    [open, storeStaff, registrations, dateStr, slot, storeId, activeSlots, dayOverlapRegs]
  );

  if (!open || !dateStr || !slot) return null;

  const { start, end } = getShiftTimesForDropSlot(slot, {});

  const handlePick = async (emp) => {
    if (assigning || !storeId) return;
    setAssigning(true);
    try {
      const res = await api.post("/shift-registrations/assign-slot", {
        employeeId: emp.employeeId,
        storeId: Number(storeId),
        workDate: dateStr,
        startTime: start,
        endTime: end,
      });
      const msg = res?.data?.message;
      if (msg && String(msg).toLowerCase().includes("cảnh báo")) alert(msg);
      onClose?.();
      onAssigned?.();
    } catch (e) {
      alert(e?.response?.data?.message || "Không thể phân ca");
      onAssigned?.();
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Đóng" />
      <div className="relative bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-xl p-4 max-h-[70vh] flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-sm font-bold text-blue-gray-900">Phân NV vào khung giờ</p>
            <p className="text-xs text-blue-gray-600 mt-0.5">
              {weekdayLabel(dateStr)} {dayMonthLabel(dateStr)} · {slot.sub || `${start}–${end}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-blue-gray-50">
            <XMarkIcon className="w-5 h-5 text-blue-gray-500" />
          </button>
        </div>
        <p className="text-[11px] text-blue-gray-500 mb-2">
          Chọn NV cửa hàng cho <strong>{start}–{end}</strong> — kể cả NV <strong>chưa tự đăng ký</strong> (QL phân thay, NV thấy trên app như đã đăng ký).
        </p>
        <div className="flex-1 overflow-y-auto space-y-2">
          {!storeId ? (
            <p className="text-sm text-amber-700 text-center py-6">Chọn cửa hàng ở bộ lọc phía trên trước.</p>
          ) : staffLoading ? (
            <p className="text-sm text-gray-400 text-center py-6">Đang tải danh sách NV...</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              Không còn NV trống khung {start}–{end} (đã phân hoặc trùng giờ khác).
            </p>
          ) : candidates.map((emp) => (
            <button
              key={emp.employeeId}
              type="button"
              disabled={assigning}
              onClick={() => handlePick(emp)}
              className="w-full flex items-center gap-2 rounded-xl border border-blue-gray-200 px-3 py-2.5 text-left hover:bg-green-50 hover:border-green-300 active:bg-green-100 transition-colors disabled:opacity-50"
            >
              <span className="shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-xs font-bold">
                {employeeInitials(emp.employeeName)}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-blue-gray-900 truncate">{emp.employeeName}</span>
                <span className="block text-[10px] text-blue-gray-500">
                  {emp.hasSelfRegistered
                    ? `${emp.regCount} ca đăng ký${emp.pendingCount > 0 ? ` · ${emp.pendingCount} chờ duyệt` : ""}`
                    : "Chưa tự đăng ký — QL phân thay"}
                </span>
              </span>
              <span className="text-xs font-bold text-green-700 shrink-0">+ Phân</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Lưới phân ca: hàng = ca động từ ShiftTemplates, cột = ngày (7 hoặc 14 ngày). */
export default function ManagerScheduleGrid({
  registrations = [],
  staffingByDate = {},
  laborByDate = {},
  requiredStaff = 5,
  weekStart,
  twoWeeks = false,
  loading = false,
  storeName = "",
  storeId = "",
  shiftSlots,          // dynamic slots từ ShiftTemplates API
  onWeekChange,
  onDayClick,
  onReassigned,
  readOnly = false,
}) {
  const [pickedReg, setPickedReg] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  // Luôn expand theo giờ — dùng templates API hoặc ca mặc định sáng/chiều
  const activeSlots = useMemo(() => {
    const source = shiftSlots?.length > 0 ? shiftSlots : DEFAULT_SHIFT_TEMPLATES;
    return templatesAsHourSlots(source);
  }, [shiftSlots]);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const dates = useMemo(() => {
    if (twoWeeks) {
      const base = new Date(`${weekStart}T12:00:00`);
      const list = [];
      for (let i = 0; i < 14; i++) {
        const x = new Date(base);
        x.setDate(base.getDate() + i);
        list.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`);
      }
      return list;
    }
    return getWeekDates(weekStart);
  }, [weekStart, twoWeeks]);

  const displayRegs = useMemo(
    () => registrations.filter((r) => r.status === "Pending" || r.status === "Approved"),
    [registrations]
  );
  const grid = useMemo(() => buildScheduleGrid(displayRegs, dates, activeSlots), [displayRegs, dates, activeSlots]);
  const validDropKeys = useMemo(
    () => getValidDropCellKeys(registrations, pickedReg, dates, activeSlots),
    [registrations, pickedReg, dates, activeSlots]
  );
  const todayStr = localTodayStr();
  const isPastDay = (d) => d < todayStr;
  const weekStats = useMemo(
    () => computeScheduleStats(displayRegs, dates, storeId, activeSlots),
    [displayRegs, dates, storeId, activeSlots]
  );
  const resolveDisplayName = useMemo(
    () => buildEmployeeDisplayNameResolver(displayRegs),
    [displayRegs]
  );

  const step = twoWeeks ? 14 : 7;
  const pickMode = !!pickedReg?.reg;
  const isHourGrid = activeSlots.some((s) => s.parentStart != null);

  const handlePick = (reg, slot) => {
    if (readOnly || isPastDay(reg.workDate?.slice(0, 10))) return;
    const { start, end } = getShiftTimesForDropSlot(slot, reg);
    setPickedReg((prev) =>
      prev?.reg?.id === reg.id && prev?.sliceStart === start ? null : {
        reg,
        sliceStart: start,
        sliceEnd: end,
        parentStart: slot?.parentStart ?? slot?.start,
        parentEnd: slot?.parentEnd ?? slot?.end,
        parentLabel: slot?.parentLabel ?? slot?.label,
      }
    );
    setDragOverKey(null);
  };

  const buildSliceBody = (reg, slot) => {
    if (!slot) return {};
    const { start, end } = getShiftTimesForDropSlot(slot, reg);
    return { sliceStart: start, sliceEnd: end };
  };

  const handleUnassign = async (reg, slot) => {
    if (readOnly || saving || !reg || isPastDay(reg.workDate?.slice(0, 10))) return;
    const payload = buildHourSlotPayload(reg, slot);
    const label = `${reg.employeeName} · ${payload.startTime}–${payload.endTime} · ${payload.workDate || ""}`;
    if (!confirm(`Bỏ khung giờ này?\n${label}\n(Các giờ khác trong ca giữ nguyên)`)) return;
    setSaving(true);
    try {
      if (isHourGrid) {
        await api.post("/shift-registrations/cancel-hour", payload);
      } else {
        await api.patch(`/shift-registrations/${reg.id}/cancel`, {
          sliceStart: payload.startTime,
          sliceEnd: payload.endTime,
        });
      }
      if (pickedReg?.reg?.id === reg.id) setPickedReg(null);
      onReassigned?.();
    } catch (e) {
      alert(e?.response?.data?.message || "Không thể bỏ phân ca");
      onReassigned?.();
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (reg, slot) => {
    if (readOnly || saving || !reg || reg.status === "Approved" || isPastDay(reg.workDate?.slice(0, 10))) return;
    const payload = buildHourSlotPayload(reg, slot);
    setSaving(true);
    try {
      if (isHourGrid) {
        const res = await api.post("/shift-registrations/approve-hour", payload);
        const msg = res?.data?.message;
        if (msg && String(msg).toLowerCase().includes("cảnh báo")) alert(msg);
      } else {
        const res = await api.patch(`/shift-registrations/${reg.id}/approve`, {
          sliceStart: payload.startTime,
          sliceEnd: payload.endTime,
        });
        const msg = res?.data?.message;
        if (msg && String(msg).toLowerCase().includes("cảnh báo")) alert(msg);
      }
      if (pickedReg?.reg?.id === reg.id) setPickedReg(null);
      onReassigned?.();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || "Không thể duyệt ca";
      alert(msg);
      onReassigned?.();
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (targetDate, slotId) => {
    if (readOnly || !pickedReg?.reg || saving || isPastDay(targetDate)) return;
    const slot = activeSlots.find((s) => s.id === slotId);
    if (!slot) return;

    if (!canDropRegOnCell(registrations, pickedReg, targetDate, slotId, activeSlots)) {
      return;
    }

    const { start, end } = getShiftTimesForDropSlot(slot, pickedReg.reg);
    const srcDate = pickedReg.reg.workDate?.slice(0, 10);
    const payload = {
      storeId: pickedReg.reg.storeId,
      startTime: start,
      endTime: end,
    };
    if (isHourGrid && pickedReg.sliceStart && pickedReg.sliceEnd) {
      payload.sliceStart = pickedReg.sliceStart;
      payload.sliceEnd = pickedReg.sliceEnd;
    }
    if (srcDate !== targetDate) {
      payload.workDate = targetDate;
    }

    setSaving(true);
    try {
      await api.patch(`/shift-registrations/${pickedReg.reg.id}/reassign`, payload);
      setPickedReg(null);
      onReassigned?.();
    } catch (e) {
      alert(e?.response?.data?.message || "Không thể phân ca");
    } finally {
      setSaving(false);
      setDragOverKey(null);
    }
  };

  const openAssignPanel = (d, slot) => {
    if (readOnly || isPastDay(d)) return;
    const sid = storeId || registrations.find((r) => r.workDate?.slice(0, 10) === d)?.storeId;
    if (!sid) {
      alert("Chọn cửa hàng ở bộ lọc phía trên trước khi phân ca.");
      return;
    }
    setAssignTarget({ date: d, slot });
  };

  const handleCellClick = (e, d, slotId, dayRegs, cellKey, slot) => {
    e.stopPropagation();
    if (pickMode) {
      if (validDropKeys.has(cellKey)) {
        handleAssign(d, slotId);
      }
      return;
    }
    if (!readOnly) {
      openAssignPanel(d, slot);
      return;
    }
    onDayClick?.(d, dayRegs);
  };

  if (loading) {
    return <p className="py-12 text-center text-gray-400 text-sm">Đang tải lưới phân ca...</p>;
  }

  return (
    <div className="p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <Typography variant="small" className="font-bold text-blue-gray-900">
            Lưới phân ca {storeName ? `· ${storeName}` : ""}
          </Typography>
          <Typography variant="small" color="gray" className="text-xs">
            {formatRangeLabel(dates)}
          </Typography>
        </div>
        <div className="flex items-center gap-1 text-sm text-blue-gray-600">
          <button type="button" className="p-1.5 rounded-lg hover:bg-blue-gray-50 touch-manipulation" onClick={() => onWeekChange?.(addDays(weekStart, -step))}>
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <button type="button" className="px-2 py-1.5 text-xs rounded-lg border border-blue-gray-200 hover:bg-blue-50 touch-manipulation" onClick={() => onWeekChange?.(getMondayOfWeek(new Date()))}>
            Hôm nay
          </button>
          <button type="button" className="p-1.5 rounded-lg hover:bg-blue-gray-50 touch-manipulation" onClick={() => onWeekChange?.(addDays(weekStart, step))}>
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {readOnly ? (
        <div className="flex flex-wrap gap-2 mb-3 text-[10px] sm:text-xs text-blue-gray-600">
          <span>Chế độ xem — bấm ngày trên lưới để xem chi tiết ca.</span>
        </div>
      ) : pickedReg?.reg ? (
        <div className="sticky top-0 z-30 mb-3 p-3 rounded-xl bg-indigo-600 text-white shadow-lg flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs sm:text-sm">
            <strong>{pickedReg.reg.employeeName}</strong>
            <span className="opacity-90"> · {pickedReg.sliceStart}–{pickedReg.sliceEnd}</span>
            {pickedReg.parentLabel ? (
              <span className="opacity-90"> · {pickedReg.parentLabel}</span>
            ) : null}
            <span className="opacity-90"> — ô xanh = </span>
            <strong className="text-green-200">đặt vào giờ trống</strong>
            <span className="opacity-90"> (cùng {pickedReg.parentLabel || "khối ca"}, không phải ca đã ĐK)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleUnassign(pickedReg.reg, { start: pickedReg.sliceStart, end: pickedReg.sliceEnd, parentStart: isHourGrid ? "1" : null })}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/90 hover:bg-red-500 text-xs font-medium touch-manipulation"
            >
              <XMarkIcon className="w-4 h-4" /> Bỏ giờ này
            </button>
            <button
              type="button"
              onClick={() => setPickedReg(null)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-medium touch-manipulation"
            >
              Đóng
            </button>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-[10px] sm:text-xs text-blue-gray-600">
          {isTouch
            ? "Bấm ô trống → chọn NV. ≡ Chạm NV → đổi giờ. Ngày quá khứ làm mờ — chỉ xem."
            : "Bấm ô trống → chọn NV. ≡ Kéo NV → đổi giờ. ✓ duyệt · ✕ bỏ. Ngày quá khứ làm mờ — không chỉnh."}
        </p>
      )}

      <ScheduleStatsBar stats={weekStats} />

      {saving ? (
        <p className="text-xs text-blue-600 mb-2 animate-pulse">Đang cập nhật phân ca...</p>
      ) : null}

      <div className="overflow-x-auto border border-blue-gray-200 rounded-xl -mx-1 px-1">
        <table className="w-full min-w-[640px] text-xs border-collapse">
          <thead>
            <tr className="bg-blue-gray-50">
              <th className="sticky left-0 z-10 bg-blue-gray-50 border-b border-r border-blue-gray-200 px-2 py-2 text-left font-semibold text-blue-gray-700 w-24 sm:w-28">
                Ca / Ngày
              </th>
              {dates.map((d) => {
                const past = isPastDay(d);
                const isToday = d === todayStr;
                const labor = laborByDate[d];
                return (
                  <th
                    key={d}
                    className={`border-b border-blue-gray-200 px-1 py-2 text-center min-w-[88px] sm:min-w-[104px] touch-manipulation cursor-pointer align-top ${
                      isToday ? "bg-amber-50 ring-2 ring-inset ring-amber-300" : past ? "bg-blue-gray-100 text-blue-gray-500" : ""
                    }`}
                    onClick={() => !pickMode && onDayClick?.(d)}
                  >
                    <div className={`font-semibold ${isToday ? "text-amber-900" : past ? "text-blue-gray-500" : "text-blue-gray-800"}`}>
                      {weekdayLabel(d)}{isToday ? " · Hôm nay" : ""}
                    </div>
                    <div className="text-[10px] text-blue-gray-500">{dayMonthLabel(d)}</div>
                    <DayLaborSummaryStrip summary={labor} compact muted={past} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {activeSlots.map((slot, slotIdx) => (
              <tr key={slot.id} className={`border-b border-blue-gray-100 last:border-b-0 ${slot.isFirstInParent ? "border-t-2 border-t-blue-gray-300" : ""}`}>
                <td className="sticky left-0 z-10 bg-white border-r border-blue-gray-200 px-2 py-1.5 align-top">
                  {slot.isFirstInParent && (
                    <div className="flex items-center gap-1 mb-0.5">
                      {slot.colorHex && (
                        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: slot.colorHex }} />
                      )}
                      <span className="font-bold text-blue-gray-700 text-[10px] uppercase tracking-wide">{slot.parentLabel}</span>
                    </div>
                  )}
                  <div className="font-medium text-blue-gray-800 text-[11px]">{slot.sub}</div>
                  {slot.isFirstInParent && (
                    <div className="text-[9px] text-blue-gray-400 mt-0.5">Max {MAX_STAFF_PER_SLOT} NV/slot</div>
                  )}
                </td>
                {dates.map((d) => {
                  const items = grid[d]?.[slot.id] || [];
                  const dayRegs = registrations.filter((r) => r.workDate?.slice(0, 10) === d);
                  const cellStoreId = items[0]?.storeId ?? dayRegs[0]?.storeId ?? registrations[0]?.storeId;
                  const slotCount = cellStoreId ? countActiveInSlot(displayRegs, cellStoreId, d, slot.id, null, true, activeSlots) : items.length;
                  const slotOver = cellStoreId && isSlotOverCapacity(displayRegs, cellStoreId, d, slot.id, null, true, activeSlots);
                  const cellKey = `${d}-${slot.id}`;
                  const isValidTarget = validDropKeys.has(cellKey) && !isPastDay(d);
                  const isOver = dragOverKey === cellKey;
                  const past = isPastDay(d);
                  const isToday = d === todayStr;
                  const cellLocked = readOnly || past;

                  let cellClass = "border-r border-blue-gray-100 last:border-r-0 px-1 py-1.5 align-top min-h-[56px] transition-all touch-manipulation relative ";
                  if (isToday && !pickMode) cellClass += "bg-amber-50/50 ";
                  if (past) cellClass += "bg-blue-gray-100/70 ";
                  if (slotOver && !pickMode) {
                    cellClass += "bg-red-50 ring-2 ring-inset ring-red-400 ";
                  } else if (pickMode && isValidTarget) {
                    cellClass += "bg-green-50 ring-2 ring-inset ring-green-500 shadow-sm ";
                  } else if (pickMode) {
                    cellClass += "opacity-40 ";
                  } else if (isOver && isValidTarget) {
                    cellClass += "bg-green-50 ring-2 ring-inset ring-green-400 ";
                  } else {
                    cellClass += "hover:bg-blue-gray-50/80 ";
                  }

                  return (
                    <td
                      key={cellKey}
                      className={cellClass}
                      onDragOver={!isTouch ? (e) => {
                        e.preventDefault();
                        if (pickedReg && isValidTarget) setDragOverKey(cellKey);
                      } : undefined}
                      onDragLeave={!isTouch ? () => setDragOverKey(null) : undefined}
                      onDrop={!isTouch ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isValidTarget) handleAssign(d, slot.id);
                      } : undefined}
                      onClick={!pickMode ? (e) => handleCellClick(e, d, slot.id, dayRegs, cellKey, slot) : undefined}
                    >
                      <div className="space-y-1 min-h-[44px]">
                        {pickMode && isValidTarget ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssign(d, slot.id);
                            }}
                            className="w-full py-1.5 rounded-lg bg-green-600 text-white text-[9px] sm:text-[10px] font-bold shadow-sm active:bg-green-700 touch-manipulation sticky top-0 z-20 leading-tight"
                          >
                            Đặt giờ
                          </button>
                        ) : null}
                        {slotOver && !pickMode ? (
                          <p className="text-[9px] text-red-700 font-semibold text-center pb-0.5">
                            {slotCount}/{MAX_STAFF_PER_SLOT} NV · Vượt mức
                          </p>
                        ) : null}
                        {items.length === 0 && !pickMode ? (
                          cellLocked ? (
                            <span className="text-[10px] text-gray-300 block text-center py-2">—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openAssignPanel(d, slot); }}
                              className="w-full text-[10px] text-indigo-500 hover:text-indigo-700 font-medium block text-center py-2 rounded-lg hover:bg-indigo-50 touch-manipulation"
                            >
                              + Chọn NV
                            </button>
                          )
                        ) : pickMode && isValidTarget && items.length === 0 ? null : (
                          items.map((r) => {
                            const sliceStart = isHourGrid ? slot.start?.slice(0, 5) : null;
                            const isSelected = pickedReg?.reg?.id === r.id
                              && (!sliceStart || pickedReg.sliceStart === sliceStart);
                            return (
                              <RegChip
                                key={`${r.employeeId}-${String(r.startTime || "").slice(0, 5)}-${String(r.endTime || "").slice(0, 5)}-${d}-${slot.id}-${r.id}`}
                                reg={r}
                                displayName={resolveDisplayName(r.employeeName)}
                                slot={slot}
                                selected={isSelected}
                                pickMode={pickMode}
                                readOnly={readOnly}
                                cellReadOnly={past}
                                draggable={!isTouch && !pickMode && !cellLocked}
                                onPick={handlePick}
                                onApprove={handleApprove}
                                onUnassign={handleUnassign}
                                onDragStart={handlePick}
                                onDragEnd={() => { setPickedReg(null); setDragOverKey(null); }}
                              />
                            );
                          })
                        )}
                        {pickMode && isValidTarget && items.length > 0 ? (
                          <p className="text-[9px] text-green-700 text-center pt-0.5">↑ bấm Chọn ở trên</p>
                        ) : null}
                        {items.length > 0 && !pickMode && !cellLocked ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openAssignPanel(d, slot); }}
                            className="w-full text-[9px] text-indigo-500 hover:text-indigo-700 font-medium py-0.5 touch-manipulation"
                          >
                            + Thêm NV
                          </button>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AssignSlotPanel
        open={!!assignTarget}
        dateStr={assignTarget?.date}
        slot={assignTarget?.slot}
        storeId={storeId || String(registrations[0]?.storeId || "")}
        registrations={registrations}
        activeSlots={activeSlots}
        onClose={() => setAssignTarget(null)}
        onAssigned={onReassigned}
      />
    </div>
  );
}
