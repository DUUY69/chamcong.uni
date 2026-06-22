import { MobileRow } from "@/components/mobile/MobileCard";
import { formatHourlyRate } from "@/utils/formatMoney";

/** Các dòng chi tiết phiếu lương — dùng chung NV xem & QL xem. */
export function PayslipLines({ d, compact }) {
  if (!d) return null;
  const fmt = (n) => Number(n || 0).toLocaleString("vi-VN") + " đ";

  if (compact) {
    return (
      <div className="text-sm space-y-1 border-t border-blue-gray-100 pt-2 mt-2">
        <MobileRow label="Lương gộp">{fmt(d.grossSalary)}</MobileRow>
        {Number(d.bonus) > 0 && <MobileRow label="Thưởng"><span className="text-green-700">+{fmt(d.bonus)}</span></MobileRow>}
        {Number(d.deliveryAllowance) > 0 && (
          <MobileRow label="Phụ cấp"><span className="text-amber-700">+{fmt(d.deliveryAllowance)}</span></MobileRow>
        )}
        {Number(d.insuranceDeduction) > 0 && (
          <MobileRow label="Trừ BH"><span className="text-orange-600">-{fmt(d.insuranceDeduction)}</span></MobileRow>
        )}
        {Number(d.deduction) > Number(d.insuranceDeduction || 0) && (
          <MobileRow label="Khấu trừ khác"><span className="text-red-600">-{fmt(Number(d.deduction) - Number(d.insuranceDeduction || 0))}</span></MobileRow>
        )}
        {d.note && <MobileRow label="Ghi chú"><span className="text-gray-600 text-xs">{d.note}</span></MobileRow>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-gray-100 bg-white overflow-hidden text-sm">
      <div className="bg-blue-gray-50 px-4 py-2 text-xs font-semibold text-blue-gray-600 uppercase">Chi tiết các khoản</div>
      <div className="p-4 space-y-2">
        <div className="flex justify-between"><span className="text-blue-gray-500">Ngày công</span><span>{d.workedDays}</span></div>
        <div className="flex justify-between"><span className="text-blue-gray-500">Tổng giờ</span><span>{Number(d.workedHours).toFixed(1)}h{Number(d.overtimeHours) > 0 ? ` (OT ${d.overtimeHours}h)` : ""}</span></div>
        <div className="flex justify-between"><span className="text-blue-gray-500">Lương/giờ</span><span>{formatHourlyRate(d)}</span></div>
        <div className="flex justify-between border-t border-blue-gray-50 pt-2"><span className="text-blue-gray-700 font-medium">Lương gộp</span><span className="font-semibold">{fmt(d.grossSalary)}</span></div>
        {Number(d.bonus) > 0 && (
          <div className="flex justify-between"><span className="text-green-700">+ Thưởng</span><span className="text-green-700">+{fmt(d.bonus)}</span></div>
        )}
        {Number(d.deliveryAllowance) > 0 && (
          <div className="flex justify-between"><span className="text-amber-700">+ Phụ cấp</span><span className="text-amber-700 font-medium">+{fmt(d.deliveryAllowance)}</span></div>
        )}
        {Number(d.insuranceDeduction) > 0 && (
          <div className="flex justify-between"><span className="text-orange-600">− Trừ BH</span><span className="text-orange-600">-{fmt(d.insuranceDeduction)}</span></div>
        )}
        {Number(d.deduction) > Number(d.insuranceDeduction || 0) && (
          <div className="flex justify-between"><span className="text-red-600">− Khấu trừ khác</span><span className="text-red-600">-{fmt(Number(d.deduction) - Number(d.insuranceDeduction || 0))}</span></div>
        )}
        {d.note && (
          <div className="rounded-lg bg-blue-gray-50 px-3 py-2 text-xs text-blue-gray-600">
            <span className="font-medium text-blue-gray-500">Ghi chú: </span>{d.note}
          </div>
        )}
        <div className="flex justify-between border-t border-blue-gray-200 pt-3 mt-1">
          <span className="font-bold text-blue-gray-900">Thực nhận</span>
          <span className="font-bold text-lg text-blue-gray-900">{fmt(d.netSalary)}</span>
        </div>
      </div>
    </div>
  );
}
