import { useState, useEffect } from "react";
import { Button, Chip, Typography } from "@material-tailwind/react";
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import api from "@/api";
import { TimeInput24, toTime24, isValidTime24 } from "@/utils/time24";
import { resolveConfirmTimes } from "@/utils/resolveAttendanceTimes";

function defaultConfirmTimes(record) {
  if (record.suggestedCheckIn && record.suggestedCheckOut) {
    return { in: toTime24(record.suggestedCheckIn), out: toTime24(record.suggestedCheckOut) };
  }
  if (record.scheduledStart && record.scheduledEnd && record.actualCheckIn && record.actualCheckOut) {
    const r = resolveConfirmTimes(record.scheduledStart, record.scheduledEnd, record.actualCheckIn, record.actualCheckOut);
    return { in: r.checkIn, out: r.checkOut };
  }
  return { in: toTime24(record.actualCheckIn), out: toTime24(record.actualCheckOut) };
}

function ReviewPanel({ record, onSaved, confirming, setConfirming }) {
  const init = defaultConfirmTimes(record);
  const [checkIn, setCheckIn] = useState(init.in);
  const [checkOut, setCheckOut] = useState(init.out);
  const [note, setNote] = useState(record.note || "");

  useEffect(() => {
    const d = defaultConfirmTimes(record);
    setCheckIn(d.in);
    setCheckOut(d.out);
    setNote(record.note || "");
  }, [record]);

  const submit = async (absent = false) => {
    if (!absent && (!isValidTime24(checkIn) || !isValidTime24(checkOut))) {
      alert("Giờ không hợp lệ. Gõ 0600 hoặc 06:00 (24h).");
      return;
    }
    const in24 = toTime24(checkIn);
    const out24 = toTime24(checkOut);
    const msg = absent
      ? `Xác nhận ${record.employeeName} KHÔNG ĐI LÀM?`
      : `Xác nhận giờ ${in24} – ${out24} cho ${record.employeeName}?`;
    if (!confirm(msg)) return;
    setConfirming(record.id);
    try {
      await api.post(`/attendance/${record.id}/manager-confirm`, {
        checkIn: absent ? undefined : in24,
        checkOut: absent ? undefined : out24,
        note: note || undefined,
        absent,
      });
      onSaved(record.id);
    } catch (e) {
      alert(e?.response?.data?.message || "Lỗi");
    } finally {
      setConfirming(null);
    }
  };

  const regIn = record.scheduledStart || "—";
  const regOut = record.scheduledEnd || "—";
  const actIn = toTime24(record.actualCheckIn) || "—";
  const actOut = toTime24(record.actualCheckOut) || "—";
  const inputCls = "w-full max-w-[5.5rem] mx-auto rounded-lg border-2 border-green-400 bg-white px-2 py-2 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-green-500/40";

  return (
    <div className="flex flex-col max-h-[90vh]">
      <div className="px-4 sm:px-6 pt-5 pb-3 border-b border-blue-gray-100">
        <Typography variant="h6" className="text-blue-gray-900 text-base sm:text-lg">
          {record.employeeName}
          {record.flaggedForReview && (
            <Chip size="sm" color="red" value="Cảnh báo" className="normal-case ml-2 inline-flex" />
          )}
        </Typography>
        <Typography variant="small" className="text-blue-gray-500 mt-0.5">
          {record.storeName}
        </Typography>
      </div>

      <div className="px-4 sm:px-6 py-4 overflow-y-auto flex-1">
        <div className="overflow-x-auto rounded-xl border border-blue-gray-200">
          <table className="w-full text-sm border-collapse min-w-[300px]">
            <thead>
              <tr className="bg-blue-gray-50 text-blue-gray-700">
                <th className="px-3 py-2.5 text-left font-semibold"> </th>
                <th className="px-3 py-2.5 text-center font-semibold">Giờ vào</th>
                <th className="px-3 py-2.5 text-center font-semibold">Giờ ra</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-blue-gray-100">
                <td className="px-3 py-3 font-medium text-blue-gray-800">Ca đăng ký</td>
                <td className="px-3 py-3 text-center font-mono">{regIn}</td>
                <td className="px-3 py-3 text-center font-mono">{regOut}</td>
              </tr>
              <tr className="border-t border-blue-gray-100 bg-amber-50/50">
                <td className="px-3 py-3 font-medium text-amber-900">NV bấm (TT)</td>
                <td className="px-3 py-3 text-center font-mono font-semibold text-amber-900">{actIn}</td>
                <td className="px-3 py-3 text-center font-mono font-semibold text-amber-900">{actOut}</td>
              </tr>
              <tr className="border-t-2 border-green-300 bg-green-50/60">
                <td className="px-3 py-3 font-semibold text-green-800">QL xác nhận</td>
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

        <p className="mt-3 text-[11px] text-blue-gray-500 leading-snug">
          Quy tắc gợi ý: vào sớm → giờ ca ĐK · vào trễ → giờ thực · ra sớm → giờ thực · ra trễ → giờ ca ĐK. QL có thể sửa trước khi xác nhận.
        </p>
        <label className="block mt-3 text-sm">
          <span className="font-medium text-blue-gray-700">Ghi chú (nếu sửa giờ)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Lý do chỉnh giờ..."
            className="mt-1.5 w-full rounded-lg border border-blue-gray-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="px-4 sm:px-6 py-4 border-t bg-blue-gray-50/80 flex flex-col sm:flex-row gap-2">
        <Button size="lg" variant="outlined" color="red" className="normal-case flex-1"
          disabled={confirming === record.id} onClick={() => submit(true)}>
          Không đi làm
        </Button>
        <Button size="lg" color="green" className="normal-case flex-1 shadow-md"
          disabled={confirming === record.id} onClick={() => submit(false)}>
          {confirming === record.id ? "Đang lưu..." : "Xác nhận giờ"}
        </Button>
      </div>
    </div>
  );
}

export default function AttendanceReviewModal({
  open,
  records = [],
  initialIndex = 0,
  onClose,
  onSaved,
}) {
  const [index, setIndex] = useState(0);
  const [confirmingId, setConfirmingId] = useState(null);
  const [queue, setQueue] = useState(records);

  useEffect(() => {
    if (open) {
      setQueue(records);
      setIndex(Math.min(Math.max(0, initialIndex), Math.max(0, records.length - 1)));
    }
  }, [open, records, initialIndex]);

  if (!open || queue.length === 0) return null;

  const current = queue[Math.min(index, queue.length - 1)];

  const handleSaved = (id) => {
    const nextQueue = queue.filter((r) => r.id !== id);
    setQueue(nextQueue);
    if (nextQueue.length === 0) {
      onSaved?.();
      onClose?.();
      return;
    }
    setIndex((i) => Math.min(i, nextQueue.length - 1));
    onSaved?.();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Đóng" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200 bg-amber-50">
          <Typography variant="small" className="font-bold text-amber-900">
            Xác nhận giờ chấm công
            {queue.length > 1 && (
              <span className="font-normal text-amber-800 ml-2">{index + 1}/{queue.length}</span>
            )}
          </Typography>
          <div className="flex items-center gap-1">
            {queue.length > 1 && (
              <>
                <button type="button" disabled={index <= 0} onClick={() => setIndex((i) => i - 1)}
                  className="p-1 rounded hover:bg-amber-100 disabled:opacity-30">
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <button type="button" disabled={index >= queue.length - 1} onClick={() => setIndex((i) => i + 1)}
                  className="p-1 rounded hover:bg-amber-100 disabled:opacity-30">
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </>
            )}
            <button type="button" onClick={onClose} className="p-1 rounded hover:bg-amber-100">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <ReviewPanel
          key={current.id}
          record={current}
          onSaved={handleSaved}
          confirming={confirmingId}
          setConfirming={setConfirmingId}
        />
      </div>
    </div>
  );
}
