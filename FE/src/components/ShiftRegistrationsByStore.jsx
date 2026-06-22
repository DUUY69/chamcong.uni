import { Chip, Typography } from "@material-tailwind/react";
import {
  formatShiftTime,
  formatWorkDateLabel,
  groupShiftsByStore,
  shiftStatusColor,
  shiftStatusLabel,
} from "@/utils/shiftFormat";

function ShiftRowActions({ reg, canApprove, onApprove, onReject, onView }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
      {onView ? (
        <button type="button" onClick={() => onView(reg)} className="text-xs text-blue-600 font-medium hover:underline">
          Chi tiết
        </button>
      ) : null}
      {canApprove && reg.status === "Pending" ? (
        <>
          <button type="button" onClick={() => onApprove(reg.id)} className="text-xs text-green-600 font-medium hover:underline">
            Duyệt
          </button>
          <button type="button" onClick={() => onReject(reg.id)} className="text-xs text-red-500 font-medium hover:underline">
            Từ chối
          </button>
        </>
      ) : (
        <span className="text-xs text-blue-gray-400">—</span>
      )}
    </div>
  );
}

/** Admin/QL: xem đăng ký ca nhóm theo cửa hàng (không bắt duyệt). */
export default function ShiftRegistrationsByStore({
  regs = [],
  stores = [],
  loading = false,
  canApprove = false,
  onApprove,
  onReject,
  onViewReg,
  emptyText = "Không có đăng ký ca trong khoảng thời gian này.",
}) {
  const groups = groupShiftsByStore(regs, stores);

  if (loading) {
    return <p className="py-12 text-center text-gray-400 text-sm">Đang tải...</p>;
  }

  if (groups.length === 0) {
    return <p className="py-12 text-center text-gray-400 text-sm">{emptyText}</p>;
  }

  return (
    <div className="divide-y divide-blue-gray-100">
      {groups.map((g) => (
        <section key={g.storeId ?? g.storeName} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div>
              <Typography variant="small" className="font-bold text-blue-gray-900 text-base">
                {g.storeName}
              </Typography>
              {g.storeAddress ? (
                <Typography variant="small" color="gray" className="text-xs mt-0.5 block">
                  {g.storeAddress}
                </Typography>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs bg-blue-gray-100 text-blue-gray-700 px-2 py-0.5 rounded-full">
                {g.items.length} ca
              </span>
              {g.pendingCount > 0 ? (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                  {g.pendingCount} chờ duyệt
                </span>
              ) : null}
              {g.approvedCount > 0 ? (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  {g.approvedCount} đã duyệt
                </span>
              ) : null}
            </div>
          </div>

          <ul className="space-y-2">
            {g.items.map((r) => (
              <li
                key={r.id}
                className={`rounded-lg border px-3 py-2.5 text-sm ${
                  r.status === "Approved"
                    ? "border-green-200 bg-green-50/50"
                    : r.status === "Pending"
                      ? "border-amber-200 bg-amber-50/40"
                      : "border-blue-gray-100 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-blue-gray-900">{r.employeeName}</span>
                      <Chip
                        size="sm"
                        color={shiftStatusColor(r.status)}
                        value={shiftStatusLabel(r.status)}
                        className="normal-case"
                      />
                    </div>
                    <p className="text-xs text-blue-gray-600 mt-1">
                      {formatWorkDateLabel(r.workDate?.slice(0, 10))}
                      {" · "}
                      <strong>{formatShiftTime(r)}</strong>
                    </p>
                    {r.rejectReason ? (
                      <p className="text-xs text-red-500 mt-1">{r.rejectReason}</p>
                    ) : null}
                  </div>
                  <ShiftRowActions
                    reg={r}
                    canApprove={canApprove}
                    onApprove={onApprove}
                    onReject={onReject}
                    onView={onViewReg}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
