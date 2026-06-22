import { useMemo, useState, useEffect } from "react";
import { Typography } from "@material-tailwind/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  CheckIcon,
} from "@heroicons/react/24/solid";
import api from "@/api";
import ScheduleStatsBar, { computeScheduleStats } from "@/components/ScheduleStatsBar";
import DayLaborSummaryStrip from "@/components/DayLaborSummaryStrip";
import { buildEmployeeDisplayNameResolver } from "@/utils/scheduleDisplayNames";
import { isRegApproved, scheduleCellTone } from "@/utils/scheduleStatusColors";
import {
  SHIFT_SLOTS,
  templatesAsHourSlots,
  buildScheduleGrid,
  addDays,
  formatDayTitle,
  getShiftTimesForDropSlot,
  weekdayLabel,
  dayMonthLabel,
  localTodayStr,
} from "@/utils/scheduleSlots";

function DayCell({
  reg, slot, readOnly, saving, onApprove, onUnassign, onAssign,
}) {
  if (!reg) {
    if (readOnly) return <span className="text-gray-200 text-center block py-2">—</span>;
    return (
      <button
        type="button"
        disabled={saving}
        onClick={() => onAssign?.(slot)}
        className="w-full h-8 rounded-md border border-dashed border-blue-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
        title="Phân NV vào giờ này"
      />
    );
  }

  const approved = isRegApproved(reg);
  const tone = scheduleCellTone(reg);
  return (
    <div
      style={tone.style}
      className={`group relative w-full h-8 rounded-md border-2 ${tone.className}`}
      title={`${reg.employeeName} · ${(reg.startTime || "").slice(0, 5)}–${(reg.endTime || "").slice(0, 5)}${approved ? " · đã duyệt" : " · chờ xử lý"}`}
      aria-label={approved ? "Đã duyệt" : "Chờ xử lý"}
    >
      {!readOnly && (
        <div className="absolute inset-0 hidden group-hover:flex items-center justify-center gap-0.5 bg-black/25 rounded-md">
          {!approved && (
            <button type="button" disabled={saving} onClick={(e) => { e.stopPropagation(); onApprove?.(reg, slot); }}
              className="p-0.5 rounded bg-white/90 text-green-700" title="Duyệt">
              <CheckIcon className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" disabled={saving} onClick={(e) => { e.stopPropagation(); onUnassign?.(reg, slot); }}
            className="p-0.5 rounded bg-white/90 text-red-600" title={approved ? "Bỏ duyệt → chờ xử lý" : "Hủy đăng ký"}>
            <XMarkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function ShiftBlockTable({
  blockLabel, blockRange, hourSlots, employees, grid, workDate, readOnly, saving,
  resolveDisplayName, onApprove, onUnassign, onAssignSlot,
}) {
  if (hourSlots.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-baseline gap-2 mb-2 px-1">
        <Typography variant="small" className="font-bold text-blue-gray-900 uppercase tracking-wide">
          {blockLabel}
        </Typography>
        <span className="text-xs text-blue-gray-500">{blockRange}</span>
      </div>
      <div className="overflow-x-auto border border-blue-gray-200 rounded-xl">
        <table className="w-full min-w-[720px] text-xs border-collapse">
          <thead>
            <tr className="bg-blue-gray-50">
              <th className="sticky left-0 z-10 bg-blue-gray-50 border-b border-r border-blue-gray-200 px-2 py-2 text-left font-semibold text-blue-gray-700 min-w-[100px]">
                Nhân viên
              </th>
              {hourSlots.map((slot) => (
                <th key={slot.id} className="border-b border-blue-gray-200 px-1 py-2 text-center font-medium text-blue-gray-600 min-w-[72px]">
                  <div className="text-[10px] leading-tight">{slot.sub}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-blue-gray-100 last:border-b-0">
                <td className="sticky left-0 z-10 bg-white border-r border-blue-gray-200 px-2 py-1.5 font-medium text-blue-gray-800 whitespace-nowrap">
                  <span className="px-1.5 py-0.5 rounded bg-blue-gray-100 inline-block">
                    {resolveDisplayName(emp.name)}
                  </span>
                </td>
                {hourSlots.map((slot) => {
                  const items = grid[workDate]?.[slot.id] || [];
                  const reg = items.find((r) => Number(r.employeeId) === Number(emp.id));
                  return (
                    <td key={slot.id} className="border-r border-blue-gray-100 last:border-r-0 px-1 py-1 align-middle">
                      <DayCell
                        reg={reg}
                        slot={slot}
                        readOnly={readOnly}
                        saving={saving}
                        onApprove={onApprove}
                        onUnassign={onUnassign}
                        onAssign={() => onAssignSlot?.(slot, emp.id)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ManagerDayScheduleGrid({
  registrations = [],
  workDate,
  storeId = "",
  storeName = "",
  shiftSlots,
  laborByDate = {},
  loading = false,
  readOnly = false,
  onDateChange,
  onReassigned,
}) {
  const [saving, setSaving] = useState(false);
  const [storeStaff, setStoreStaff] = useState([]);

  const parentSlots = shiftSlots?.length ? shiftSlots : SHIFT_SLOTS;
  const hourSlots = useMemo(
    () => templatesAsHourSlots(parentSlots.map((s) => ({
      id: s.id,
      name: s.label,
      startTime: s.start,
      endTime: s.end,
      colorHex: s.colorHex,
    }))),
    [parentSlots]
  );

  useEffect(() => {
    if (!storeId) {
      setStoreStaff([]);
      return;
    }
    let cancelled = false;
    api.get(`/stores/${storeId}/employees`)
      .then((r) => { if (!cancelled) setStoreStaff(r.data?.data || []); })
      .catch(() => { if (!cancelled) setStoreStaff([]); });
    return () => { cancelled = true; };
  }, [storeId]);

  const dayRegs = useMemo(() => {
    const sid = storeId ? Number(storeId) : null;
    return registrations.filter((r) => {
      if (r.workDate?.slice(0, 10) !== workDate) return false;
      if (r.status !== "Pending" && r.status !== "Approved") return false;
      if (sid && Number(r.storeId) !== sid) return false;
      return true;
    });
  }, [registrations, workDate, storeId]);

  const grid = useMemo(
    () => buildScheduleGrid(dayRegs, [workDate], hourSlots),
    [dayRegs, workDate, hourSlots]
  );

  const employees = useMemo(() => {
    const map = new Map();
    for (const s of storeStaff) {
      if (s.isActive === false) continue;
      map.set(s.id, { id: s.id, name: s.fullName });
    }
    for (const r of dayRegs) {
      if (!map.has(r.employeeId)) {
        map.set(r.employeeId, { id: r.employeeId, name: r.employeeName });
      }
    }
    return [...map.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), "vi"));
  }, [storeStaff, dayRegs]);

  const stats = useMemo(
    () => computeScheduleStats(dayRegs, [workDate], storeId, hourSlots),
    [dayRegs, workDate, storeId, hourSlots]
  );
  const resolveDisplayName = useMemo(
    () => buildEmployeeDisplayNameResolver(dayRegs),
    [dayRegs]
  );
  const isPast = workDate < localTodayStr();
  const effectiveReadOnly = readOnly || isPast;

  const blocks = useMemo(() => parentSlots.map((parent) => ({
    parent,
    hours: hourSlots.filter((s) => s.parentStart === parent.start || s.parentLabel === parent.label),
  })), [parentSlots, hourSlots]);

  const buildSliceBody = (reg, slot) => {
    const { start, end } = getShiftTimesForDropSlot(slot, reg);
    return { sliceStart: start, sliceEnd: end };
  };

  const handleApprove = async (reg, slot) => {
    if (effectiveReadOnly || saving || !reg) return;
    const { start, end } = getShiftTimesForDropSlot(slot, reg);
    setSaving(true);
    try {
      const res = await api.patch(`/shift-registrations/${reg.id}/approve`, { sliceStart: start, sliceEnd: end });
      const msg = res?.data?.message;
      if (msg && String(msg).toLowerCase().includes("cảnh báo")) alert(msg);
      onReassigned?.();
    } catch (e) {
      alert(e?.response?.data?.message || "Không thể duyệt");
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (reg, slot) => {
    if (effectiveReadOnly || saving || !reg) return;
    const approved = isRegApproved(reg);
    const confirmMsg = approved
      ? `Bỏ duyệt ${reg.employeeName} · ${slot.sub}?\nCa sẽ chuyển về trạng thái chờ xử lý (xanh dương).`
      : `Hủy đăng ký ${reg.employeeName} · ${slot.sub}?`;
    if (!confirm(confirmMsg)) return;
    setSaving(true);
    try {
      const body = buildSliceBody(reg, slot);
      if (approved) {
        await api.patch(`/shift-registrations/${reg.id}/unapprove`, body);
      } else {
        await api.patch(`/shift-registrations/${reg.id}/cancel`, body);
      }
      onReassigned?.();
    } catch (e) {
      alert(e?.response?.data?.message || (approved ? "Không thể bỏ duyệt" : "Không thể hủy đăng ký"));
    } finally {
      setSaving(false);
    }
  };

  const handleAssignSlot = async (slot, employeeId) => {
    if (effectiveReadOnly || saving || !storeId) return;
    const { start, end } = getShiftTimesForDropSlot(slot, {});
    setSaving(true);
    try {
      const res = await api.post("/shift-registrations/assign-slot", {
        employeeId,
        storeId: Number(storeId),
        workDate,
        startTime: start,
        endTime: end,
      });
      const msg = res?.data?.message;
      if (msg && String(msg).toLowerCase().includes("cảnh báo")) alert(msg);
      onReassigned?.();
    } catch (e) {
      alert(e?.response?.data?.message || "Không thể phân ca");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="py-12 text-center text-gray-400 text-sm">Đang tải lưới ngày...</p>;
  }

  if (!storeId) {
    return (
      <p className="py-10 text-center text-amber-800 text-sm px-4">
        Chọn <strong>cửa hàng</strong> ở bộ lọc phía trên để xem lưới theo ngày.
      </p>
    );
  }

  return (
    <div className={`p-3 sm:p-4 ${isPast ? "bg-blue-gray-50/50 rounded-xl" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Typography variant="small" className="font-bold text-blue-gray-900 uppercase tracking-wide">
          Đăng ký ca làm việc {storeName ? `· ${storeName}` : ""}
        </Typography>
        <div className="flex items-center gap-1 text-sm text-blue-gray-700">
          <button type="button" className="p-1.5 rounded-lg hover:bg-blue-gray-50" onClick={() => onDateChange?.(addDays(workDate, -1))}>
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <span className="font-semibold min-w-[180px] text-center">{formatDayTitle(workDate)}</span>
          <button type="button" className="p-1.5 rounded-lg hover:bg-blue-gray-50" onClick={() => onDateChange?.(addDays(workDate, 1))}>
            <ChevronRightIcon className="w-5 h-5" />
          </button>
          <button type="button" className="ml-1 px-2 py-1 text-xs rounded-lg border border-blue-gray-200 hover:bg-blue-50"
            onClick={() => onDateChange?.(localTodayStr())}>
            Hôm nay
          </button>
        </div>
      </div>

      <ScheduleStatsBar stats={stats} />

      <div className="mb-3 rounded-lg border border-blue-gray-100 bg-blue-gray-50/80 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-gray-500 mb-1">
          Giờ & lương dự kiến (ca đã duyệt)
        </p>
        {(() => {
          const labor = laborByDate[workDate];
          const hasLabor = labor && (
            labor.employeeHours > 0 || labor.managerHours > 0
            || labor.employeeEstPay > 0 || labor.managerEstPay > 0
          );
          if (hasLabor) return <DayLaborSummaryStrip summary={labor} />;
          return <p className="text-xs text-blue-gray-400">Chưa có ca đã duyệt trong ngày này.</p>;
        })()}
      </div>

      {isPast && (
        <p className="text-xs text-blue-gray-500 mb-3 bg-blue-gray-50 rounded-lg px-3 py-2">
          Ngày đã qua — chỉ xem, không chỉnh sửa phân ca.
        </p>
      )}

      {employees.length === 0 ? (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-6 text-center">
          Chưa có NV gán cửa hàng này — thêm NV vào CH trước khi phân ca.
        </p>
      ) : (
        blocks.map(({ parent, hours }) => (
          <ShiftBlockTable
            key={parent.id}
            blockLabel={parent.label}
            blockRange={`${parent.start} – ${parent.end}`}
            hourSlots={hours}
            employees={employees}
            grid={grid}
            workDate={workDate}
            readOnly={effectiveReadOnly}
            saving={saving}
            resolveDisplayName={resolveDisplayName}
            onApprove={handleApprove}
            onUnassign={handleUnassign}
            onAssignSlot={handleAssignSlot}
          />
        ))
      )}

      {!effectiveReadOnly && (
        <p className="text-[11px] text-blue-gray-500 mt-2 flex items-center gap-1">
          <span className="text-blue-gray-400">ⓘ</span>
          Ô xanh dương = chờ xử lý · xanh lá = đã duyệt · bấm ô trống để QL phân ca (kể cả NV chưa tự đăng ký)
        </p>
      )}

      {saving ? <p className="text-xs text-blue-600 mt-2 animate-pulse">Đang cập nhật...</p> : null}
    </div>
  );
}
