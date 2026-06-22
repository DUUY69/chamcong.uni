import {
  UserGroupIcon,
  ClockIcon,
  UserPlusIcon,
} from "@heroicons/react/24/solid";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { isSlotOverCapacity } from "@/utils/scheduleSlots";

function StatCard({ icon: Icon, label, value, tone = "default" }) {
  const tones = {
    default: "bg-white border-blue-gray-100 text-blue-gray-900",
    green: "bg-green-50 border-green-200 text-green-900",
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 flex items-center gap-2 min-w-[130px] flex-1 sm:flex-none ${tones[tone] || tones.default}`}>
      {Icon ? <Icon className="w-5 h-5 shrink-0 opacity-80" /> : null}
      <div className="min-w-0">
        <p className="text-[10px] text-blue-gray-500 leading-tight truncate">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

export function computeScheduleStats(regs, dates, storeId, hourSlots) {
  const dateSet = new Set(dates);
  const sid = storeId ? Number(storeId) : null;
  const filtered = (regs || []).filter((r) => {
    const d = r.workDate?.slice(0, 10);
    if (!dateSet.has(d)) return false;
    if (sid && Number(r.storeId) !== sid) return false;
    return r.status === "Pending" || r.status === "Approved";
  });

  const employeeIds = new Set(filtered.map((r) => r.employeeId));
  let overSlots = 0;
  if (sid && hourSlots?.length) {
    for (const d of dates) {
      for (const slot of hourSlots) {
        if (isSlotOverCapacity(filtered, storeId, d, slot.id, null, false, hourSlots)) {
          overSlots += 1;
        }
      }
    }
  }

  return {
    totalEmployees: employeeIds.size,
    approved: filtered.filter((r) => r.status === "Approved").length,
    pending: filtered.filter((r) => r.status === "Pending").length,
    overSlots,
  };
}

export default function ScheduleStatsBar({ stats, className = "" }) {
  if (!stats) return null;
  return (
    <div className={`flex flex-wrap gap-2 mb-4 items-start justify-between ${className}`}>
      <div className="flex flex-wrap gap-2 flex-1">
        <StatCard icon={UserGroupIcon} label="Tổng nhân viên" value={stats.totalEmployees} />
        <StatCard icon={CheckCircleIcon} label="Đã xác nhận" value={stats.approved} tone="green" />
        <StatCard icon={ClockIcon} label="Chờ xử lý" value={stats.pending} tone="blue" />
        <StatCard icon={UserPlusIcon} label="Dư nhân sự" value={`${stats.overSlots} khung giờ`} tone="amber" />
      </div>
      <div className="text-[10px] text-blue-gray-500 border border-blue-gray-100 rounded-lg px-2 py-1.5 bg-white shrink-0">
        <span className="inline-flex items-center gap-1 mr-2">
          <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: "#22c55e" }} /> Đã xác nhận
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: "#2563eb" }} /> Chờ xử lý
        </span>
      </div>
    </div>
  );
}
