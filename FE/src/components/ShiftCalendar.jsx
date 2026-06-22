import { useMemo } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { getEmployeeDayBlockReason, localTodayStr } from "@/utils/scheduleSlots";

const DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTH_NAMES = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

function activeRegs(regs) {
  return regs.filter((r) => r.status === "Pending" || r.status === "Approved");
}

/** employee: empty | pending | approved | past */
function employeeDayState(regs, dateStr, todayStr) {
  if (dateStr <= todayStr) return "past";
  const active = activeRegs(regs);
  if (active.some((r) => r.status === "Pending")) return "pending";
  if (active.some((r) => r.status === "Approved")) return "approved";
  return "empty";
}

/** manager: empty | under | pending | approved | over */
function managerDayState(regs, summary) {
  if (summary) {
    const { status, approvedCount, required, pendingCount } = summary;
    if (status === "over") return "over";
    if (status === "none" && !pendingCount) return "empty";
    if (approvedCount >= required) return pendingCount > 0 ? "pending" : "approved";
    if (pendingCount > 0 || approvedCount > 0) return "under";
    return "empty";
  }
  const active = activeRegs(regs);
  if (active.length === 0) return "empty";
  if (active.some((r) => r.status === "Pending")) return "pending";
  return "approved";
}

const EMPLOYEE_STYLES = {
  past: "bg-gray-100 text-gray-400 border border-gray-200 cursor-pointer",
  empty: "bg-gray-200 text-gray-700 hover:bg-gray-300 hover:ring-2 hover:ring-gray-400 cursor-pointer",
  pending: "bg-blue-500 text-white hover:bg-blue-600 hover:ring-2 hover:ring-blue-300 cursor-pointer shadow-sm",
  approved: "bg-green-500 text-white hover:bg-green-600 hover:ring-2 hover:ring-green-300 cursor-pointer shadow-sm",
};

const MANAGER_STYLES = {
  empty: "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:ring-2 hover:ring-gray-300 cursor-pointer border border-gray-200",
  under: "bg-amber-50 text-amber-900 hover:bg-amber-100 hover:ring-2 hover:ring-amber-400 cursor-pointer border-2 border-amber-400 shadow-sm",
  pending: "bg-blue-50 text-blue-900 hover:bg-blue-100 hover:ring-2 hover:ring-blue-400 cursor-pointer border-2 border-blue-400 shadow-sm",
  approved: "bg-green-50 text-green-900 hover:bg-green-100 hover:ring-2 hover:ring-green-400 cursor-pointer border-2 border-green-400 shadow-sm",
  over: "bg-red-50 text-red-900 hover:bg-red-100 hover:ring-2 hover:ring-red-400 cursor-pointer border-2 border-red-400 shadow-sm",
};

export default function ShiftCalendar({
  mode = "employee",
  year,
  month,
  registrations,
  staffingByDate = {},
  requiredStaff = 5,
  onMonthChange,
  onDayClick,
  onBlockedDayClick,
}) {
  const isManager = mode === "manager";
  const todayStr = localTodayStr();

  const regByDate = useMemo(() => {
    const m = {};
    registrations.forEach((r) => {
      const d = r.workDate?.slice(0, 10);
      if (!d) return;
      if (!m[d]) m[d] = [];
      m[d].push(r);
    });
    return m;
  }, [registrations]);

  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="p-4">
      <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 text-xs text-gray-600 items-center">
        {isManager ? (
          <span className="text-gray-400 italic hidden sm:inline">Nhấn ngày để duyệt & phân ca</span>
        ) : (<>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-gray-200 border border-gray-300 inline-block" /> Chưa đăng ký</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-blue-500 inline-block" /> Chờ duyệt</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-green-500 inline-block" /> Đã duyệt</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-gray-100 border border-gray-200 inline-block" /> Hôm nay / quá khứ</span>
        </>)}
      </div>

      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => onMonthChange(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)}
          className="p-2 rounded-lg hover:bg-blue-gray-50 text-blue-gray-600">
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <span className="font-bold text-blue-gray-800">{MONTH_NAMES[month - 1]} {year}</span>
        <button type="button" onClick={() => onMonthChange(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1)}
          className="p-2 rounded-lg hover:bg-blue-gray-50 text-blue-gray-600">
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {DOW.map((d) => (
          <div key={d} className="text-center text-[10px] sm:text-xs font-semibold text-blue-gray-500 pb-1">{d}</div>
        ))}
        {cells.map((d, idx) => {
          if (!d) return <div key={`e_${idx}`} />;
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const dayRegs = regByDate[dateStr] || [];
          const active = activeRegs(dayRegs);
          const daySummary = staffingByDate[dateStr];
          const pendingCount = daySummary?.pendingCount ?? active.filter((r) => r.status === "Pending").length;
          const state = isManager
            ? managerDayState(dayRegs, daySummary)
            : employeeDayState(dayRegs, dateStr, todayStr);
          const isToday = dateStr === todayStr;
          const blockReason = !isManager ? getEmployeeDayBlockReason(dateStr, { todayStr }) : null;
          const styles = isManager ? MANAGER_STYLES : EMPLOYEE_STYLES;

          const handleDayPress = () => {
            if (blockReason) {
              onBlockedDayClick?.(dateStr, blockReason);
              return;
            }
            onDayClick(dateStr, dayRegs);
          };

          return (
            <button
              key={d}
              type="button"
              onClick={handleDayPress}
              aria-label={blockReason ? `${d} — ${blockReason}` : String(d)}
              className={`
                relative min-h-[44px] sm:min-h-[52px] rounded-lg transition-all
                flex flex-col items-center justify-center gap-0.5 p-1
                ${styles[state] || styles.empty}
                ${isToday && !blockReason ? "ring-2 ring-amber-400 ring-offset-1" : ""}
                ${isToday && blockReason ? "ring-2 ring-gray-300 ring-offset-1" : ""}
              `}
            >
              <span className={`text-sm sm:text-base ${isManager ? "font-semibold" : "font-bold"}`}>{d}</span>
              {!isManager && blockReason && (
                <span className="text-[8px] leading-none text-center px-0.5 opacity-80">✕</span>
              )}
              {isManager && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-white text-[8px] font-bold rounded-full min-w-[14px] h-3.5 px-0.5 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
              {!isManager && active.length > 1 && (
                <span className="absolute top-0.5 right-0.5 text-[8px] bg-white/90 text-blue-gray-800 rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                  {active.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
