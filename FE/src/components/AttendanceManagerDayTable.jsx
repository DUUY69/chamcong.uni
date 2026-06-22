import { useMemo } from "react";
import { Typography, Button, Chip } from "@material-tailwind/react";
import { formatDateVi } from "@/utils/dates";

function formatHours(h) {
  if (h == null || Number.isNaN(Number(h))) return "—";
  return `${Number(h).toFixed(1)}h`;
}

function hoursCell(row) {
  if (row.punchStatus === "Confirmed" && row.confirmedHours != null)
    return { text: formatHours(row.confirmedHours), hint: row.confirmedCheckIn && row.confirmedCheckOut ? `${row.confirmedCheckIn}–${row.confirmedCheckOut}` : null, tone: "text-green-800 font-semibold" };
  if (row.punchStatus === "PendingReview" && row.suggestedHours != null)
    return { text: `~${formatHours(row.suggestedHours)}`, hint: row.suggestedCheckIn && row.suggestedCheckOut ? `${row.suggestedCheckIn}–${row.suggestedCheckOut}` : null, tone: "text-amber-800" };
  if (row.punchStatus === "Absent") return { text: "0h", hint: "Vắng", tone: "text-red-600" };
  if (row.scheduledHours != null)
    return { text: "—", hint: `Ca ĐK: ${formatHours(row.scheduledHours)}`, tone: "text-blue-gray-400" };
  return { text: "—", hint: null, tone: "text-blue-gray-400" };
}

const statusChip = {
  None: { color: "gray", label: "Chưa chấm" },
  Open: { color: "blue", label: "Đang ca" },
  PendingReview: { color: "amber", label: "Chờ xác nhận" },
  Confirmed: { color: "green", label: "Đã xác nhận" },
  Absent: { color: "red", label: "Vắng" },
};

/** Bảng chấm công ngày — gộp ca đăng ký + thực tế + trạng thái (1 bảng duy nhất). */
export default function AttendanceManagerDayTable({
  workDate,
  rows = [],
  pendingCount = 0,
  loading = false,
  eodLoading = false,
  onConfirmRow,
  onMarkAbsent,
  onEndOfDay,
  onDelete,
  onManualRecord,
  onEditConfirmed,
}) {
  const totals = useMemo(() => {
    let confirmed = 0;
    let confirmedCount = 0;
    let pending = 0;
    let pendingCount = 0;
    for (const r of rows) {
      if (r.punchStatus === "Confirmed" && r.confirmedHours != null) {
        confirmed += Number(r.confirmedHours);
        confirmedCount++;
      }
      if (r.punchStatus === "PendingReview" && r.suggestedHours != null) {
        pending += Number(r.suggestedHours);
        pendingCount++;
      }
    }
    return { confirmed, confirmedCount, pending, pendingCount };
  }, [rows]);

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <Typography variant="small" className="font-bold text-blue-gray-900">
            Chấm công — {formatDateVi(workDate)}
          </Typography>
          <Typography variant="small" className="text-blue-gray-500 text-xs mt-0.5 block">
            QL xác nhận giờ NV bấm (24h). NV quên chấm → bấm «Chấm hộ».
          </Typography>
          {rows.length > 0 && (
            <Typography variant="small" className="text-green-800 text-xs mt-1 block font-medium">
              Tổng giờ đã xác nhận: {formatHours(totals.confirmed)} ({totals.confirmedCount} ca)
              {totals.pendingCount > 0 && (
                <span className="text-amber-700 font-normal"> · chờ duyệt ~{formatHours(totals.pending)} ({totals.pendingCount} ca)</span>
              )}
            </Typography>
          )}
        </div>
        {pendingCount > 0 && (
          <Button size="sm" color="green" disabled={eodLoading} onClick={onEndOfDay} className="normal-case">
            {eodLoading ? "Đang xử lý..." : `Xác nhận tất cả (${pendingCount})`}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-blue-gray-200">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-3 py-2.5 text-center w-10">STT</th>
              <th className="px-3 py-2.5 text-left">Nhân viên</th>
              <th className="px-3 py-2.5 text-left">Cửa hàng</th>
              <th className="px-3 py-2.5 text-center">Ca đăng ký</th>
              <th className="px-3 py-2.5 text-center">Giờ vào TT</th>
              <th className="px-3 py-2.5 text-center">Giờ ra TT</th>
              <th className="px-3 py-2.5 text-center">Giờ xác nhận</th>
              <th className="px-3 py-2.5 text-center">Trạng thái</th>
              <th className="px-3 py-2.5 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-12 text-center text-gray-400">Đang tải...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-gray-500">
                  Không có ca đã duyệt ngày {formatDateVi(workDate)}.
                </td>
              </tr>
            ) : rows.map((row, i) => {
              const st = statusChip[row.punchStatus] || statusChip.None;
              const actualIn = row.actualCheckIn || "—";
              const actualOut = row.actualCheckOut || "—";
              const isPending = row.punchStatus === "PendingReview";
              const hrs = hoursCell(row);

              return (
                <tr
                  key={`${row.employeeId}-${row.storeId}-${row.scheduledStart}-${row.scheduledEnd}`}
                  className={`border-t border-blue-gray-100 ${i % 2 ? "bg-blue-50/20" : "bg-white"} ${isPending ? "bg-amber-50/40" : ""}`}
                >
                  <td className="px-3 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium">
                    {row.employeeName}
                    <span className="text-xs text-gray-400 block">{row.employeeCode}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs">{row.storeName}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-blue-gray-800">
                    {row.scheduledStart}–{row.scheduledEnd}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono font-semibold text-amber-900">
                    {actualIn}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono font-semibold text-amber-900">
                    {actualOut}
                  </td>
                  <td className={`px-3 py-2.5 text-center font-mono text-sm ${hrs.tone}`} title={hrs.hint || undefined}>
                    {hrs.text}
                    {hrs.hint && row.punchStatus === "Confirmed" && (
                      <span className="text-[10px] text-blue-gray-400 block font-normal">{hrs.hint}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Chip size="sm" color={st.color} value={st.label} className="normal-case mx-auto w-fit" />
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    {isPending && (
                      <Button
                        size="sm"
                        color="amber"
                        className="normal-case py-1 px-3"
                        onClick={() => onConfirmRow?.(row)}
                      >
                        Xác nhận
                      </Button>
                    )}
                    {row.punchStatus === "None" && (
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onManualRecord?.(row)}
                          className="text-xs text-green-700 font-semibold hover:underline"
                        >
                          Chấm hộ
                        </button>
                        <button
                          type="button"
                          onClick={() => onMarkAbsent?.(row)}
                          className="text-xs text-red-600 font-medium hover:underline"
                        >
                          Vắng
                        </button>
                      </div>
                    )}
                    {row.punchStatus === "Open" && (
                      <button
                        type="button"
                        onClick={() => onManualRecord?.(row)}
                        className="text-xs text-blue-700 font-semibold hover:underline"
                      >
                        Sửa giờ
                      </button>
                    )}
                    {row.punchStatus === "Confirmed" && row.attendanceId && (
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditConfirmed?.(row)}
                          className="text-xs text-blue-700 font-semibold hover:underline"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete?.(row.attendanceId)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                    {!isPending && row.punchStatus !== "None" && row.punchStatus !== "Confirmed" && (
                      <span className="text-xs text-blue-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
