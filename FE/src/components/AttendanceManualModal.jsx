import { useState, useEffect } from "react";
import { Button, Typography } from "@material-tailwind/react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import api from "@/api";
import { TimeInput24, toTime24, isValidTime24 } from "@/utils/time24";
import { resolveConfirmTimes } from "@/utils/resolveAttendanceTimes";

function defaultTimes(row) {
  if (row.editMode && row.confirmedCheckIn && row.confirmedCheckOut) {
    return { in: toTime24(row.confirmedCheckIn), out: toTime24(row.confirmedCheckOut) };
  }
  if (row.actualCheckIn && row.actualCheckOut && row.scheduledStart && row.scheduledEnd) {
    const r = resolveConfirmTimes(row.scheduledStart, row.scheduledEnd, row.actualCheckIn, row.actualCheckOut);
    return { in: r.checkIn, out: r.checkOut };
  }
  return { in: toTime24(row.actualCheckIn || row.scheduledStart), out: toTime24(row.actualCheckOut || row.scheduledEnd) };
}

/** QL chấm hộ / sửa giờ khi NV quên bấm vào hoặc ra. */
export default function AttendanceManualModal({ open, row, onClose, onSaved }) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    const d = defaultTimes(row);
    setCheckIn(d.in);
    setCheckOut(d.out);
    setNote(row.note || "");
  }, [open, row]);

  if (!open || !row) return null;

  const isEdit = row.editMode === true;
  const isOpenShift = row.punchStatus === "Open";
  const inputCls = "w-full max-w-[5.5rem] mx-auto rounded-lg border-2 border-green-400 bg-white px-2 py-2 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-green-500/40";

  const submit = async () => {
    const in24 = toTime24(checkIn);
    const out24 = toTime24(checkOut);
    if (!isValidTime24(checkIn) || !isValidTime24(checkOut)) {
      alert("Giờ không hợp lệ. Gõ 0600 hoặc 06:00 (24h).");
      return;
    }
    if (!confirm(`Lưu giờ ${in24} – ${out24} cho ${row.employeeName}?`)) return;

    setSaving(true);
    try {
      if (isEdit && row.attendanceId) {
        await api.put(`/attendance/${row.attendanceId}`, {
          checkIn: in24,
          checkOut: out24,
          note: note || undefined,
        });
      } else if (isOpenShift && row.attendanceId) {
        await api.post(`/attendance/${row.attendanceId}/manager-set-times`, {
          checkIn: in24,
          checkOut: out24,
          note: note || undefined,
        });
      } else {
        await api.post("/attendance/manager-record-shift", {
          shiftRegistrationId: row.shiftRegistrationId,
          checkIn: in24,
          checkOut: out24,
          note: note || undefined,
        });
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      alert(e?.response?.data?.message || "Lỗi lưu giờ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Đóng" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-50">
          <Typography variant="small" className="font-bold text-blue-900">
            {isEdit ? "Sửa giờ đã xác nhận" : isOpenShift ? "Sửa giờ chấm công" : "Chấm hộ nhân viên"}
          </Typography>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-blue-100">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-4 space-y-4">
          <div>
            <Typography variant="small" className="font-semibold text-blue-gray-900">{row.employeeName}</Typography>
            <Typography variant="small" className="text-blue-gray-500 text-xs">{row.storeName}</Typography>
            <Typography variant="small" className="text-blue-gray-600 text-xs mt-1 font-mono">
              Ca đăng ký: {row.scheduledStart}–{row.scheduledEnd}
            </Typography>
          </div>

          {!isOpenShift && (
            <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
              NV chưa bấm chấm công — QL nhập giờ thực tế NV làm, hệ thống xác nhận luôn.
              <span className="block mt-1 text-amber-700">Gõ giờ: <strong>0600</strong> hoặc <strong>06:00</strong> (24h).</span>
            </p>
          )}
          {isOpenShift && (
            <p className="text-xs text-blue-800 bg-blue-50 rounded-lg px-3 py-2">
              NV đã bắt đầu ca nhưng chưa kết thúc / quên checkout — QL nhập giờ ra (và sửa giờ vào nếu cần).
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-blue-gray-200">
            <table className="w-full text-sm min-w-[260px]">
              <thead>
                <tr className="bg-blue-gray-50 text-blue-gray-700">
                  <th className="px-3 py-2 text-left font-semibold"> </th>
                  <th className="px-3 py-2 text-center font-semibold">Giờ vào</th>
                  <th className="px-3 py-2 text-center font-semibold">Giờ ra</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-blue-gray-100">
                  <td className="px-3 py-2 font-medium text-blue-gray-800">Ca đăng ký</td>
                  <td className="px-3 py-2 text-center font-mono">{row.scheduledStart}</td>
                  <td className="px-3 py-2 text-center font-mono">{row.scheduledEnd}</td>
                </tr>
                <tr className="border-t-2 border-green-300 bg-green-50/60">
                  <td className="px-3 py-2 font-semibold text-green-800">QL nhập</td>
                  <td className="px-3 py-2 text-center">
                    <TimeInput24 value={checkIn} onChange={setCheckIn} className={inputCls} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <TimeInput24 value={checkOut} onChange={setCheckOut} className={inputCls} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-blue-gray-700">Ghi chú</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: NV quên bấm, làm đủ ca chiều..."
              className="mt-1.5 w-full rounded-lg border border-blue-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="px-4 sm:px-6 py-4 border-t bg-blue-gray-50/80 flex gap-2">
          <Button size="lg" variant="outlined" className="normal-case flex-1" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button size="lg" color="green" className="normal-case flex-1 shadow-md" disabled={saving} onClick={submit}>
            {saving ? "Đang lưu..." : "Lưu giờ"}
          </Button>
        </div>
      </div>
    </div>
  );
}
