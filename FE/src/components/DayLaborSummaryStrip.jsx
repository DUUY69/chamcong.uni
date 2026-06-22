import { formatMoney } from "@/utils/formatMoney";
import { formatLaborHours } from "@/utils/scheduleLaborSummary";

/** Tóm tắt giờ & lương dự kiến — dùng trong header cột ngày hoặc strip ngày. */
export default function DayLaborSummaryStrip({
  summary,
  compact = false,
  muted = false,
  className = "",
}) {
  if (!summary) return null;

  const empH = formatLaborHours(summary.employeeHours);
  const mgrH = formatLaborHours(summary.managerHours);
  const empPay = Number(summary.employeeEstPay) || 0;
  const mgrPay = Number(summary.managerEstPay) || 0;
  const hasData = summary.employeeHours > 0 || summary.managerHours > 0 || empPay > 0 || mgrPay > 0;

  if (!hasData) return null;

  const textMuted = muted ? "text-blue-gray-400" : "text-blue-gray-600";
  const payMuted = muted ? "text-blue-gray-400" : "text-emerald-700";

  if (compact) {
    return (
      <div className={`mt-1 space-y-0.5 text-[9px] leading-tight font-normal ${className}`}>
        <div className={textMuted}>
          <span className="font-semibold text-blue-gray-700">NV</span> {empH}
          <span className="mx-0.5 text-blue-gray-300">·</span>
          <span className={payMuted}>{formatMoney(empPay)}</span>
        </div>
        <div className={textMuted}>
          <span className="font-semibold text-blue-gray-700">QL</span> {mgrH}
          <span className="mx-0.5 text-blue-gray-300">·</span>
          <span className={payMuted}>{formatMoney(mgrPay)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ${className}`}>
      <span className={textMuted}>
        <span className="font-semibold text-blue-gray-800">NV:</span> {empH}
        <span className="mx-1 text-blue-gray-300">|</span>
        <span className={payMuted}>{formatMoney(empPay)}</span>
      </span>
      <span className={textMuted}>
        <span className="font-semibold text-blue-gray-800">QL:</span> {mgrH}
        <span className="mx-1 text-blue-gray-300">|</span>
        <span className={payMuted}>{formatMoney(mgrPay)}</span>
      </span>
    </div>
  );
}
