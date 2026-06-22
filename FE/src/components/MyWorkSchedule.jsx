import { Chip, Typography } from "@material-tailwind/react";
import { BuildingStorefrontIcon, ClockIcon, MapPinIcon } from "@heroicons/react/24/solid";
import {
  formatShiftTime,
  formatWorkDateLabel,
  formatWorkDateShort,
  matchManagerShiftSlot,
  shiftStatusColor,
  shiftStatusLabel,
} from "@/utils/shiftFormat";

function ShiftRow({ shift, highlight }) {
  const dateKey = shift.workDate?.slice(0, 10);
  return (
    <li
      className={`rounded-xl border p-3 sm:p-4 ${
        highlight
          ? "border-blue-500 bg-blue-50/80 shadow-sm"
          : "border-blue-gray-100 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <Typography variant="small" className="font-semibold text-blue-gray-900">
          {formatWorkDateLabel(dateKey)}
        </Typography>
        <Chip
          size="sm"
          color={shiftStatusColor(shift.status)}
          value={shiftStatusLabel(shift.status)}
          className="normal-case shrink-0"
        />
      </div>
      <div className="space-y-1.5 text-sm text-blue-gray-700">
        <p className="flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <span className="text-blue-gray-500">
              {matchManagerShiftSlot(shift) ? "Ca phân công:" : "Giờ đăng ký:"}
            </span>{" "}
            <strong className="text-blue-gray-900">{formatShiftTime(shift)}</strong>
          </span>
        </p>
        <p className="flex items-start gap-2">
          <BuildingStorefrontIcon className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <span>
            <span className="text-blue-gray-500">Làm tại:</span>{" "}
            <strong className="text-blue-gray-900">{shift.storeName || "—"}</strong>
          </span>
        </p>
        {shift.storeAddress ? (
          <p className="flex items-start gap-2">
            <MapPinIcon className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <span>
              <span className="text-blue-gray-500">Địa chỉ:</span> {shift.storeAddress}
            </span>
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** Danh sách ca làm: ngày, giờ, cửa hàng, địa chỉ. */
export default function MyWorkSchedule({
  shifts = [],
  title = "Lịch làm của tôi",
  subtitle,
  emptyText = "Chưa có ca nào trong khoảng thời gian này.",
  highlightToday = true,
  compact = false,
}) {
  const today = new Date().toISOString().slice(0, 10);

  if (shifts.length === 0) {
    return (
      <div className="text-sm text-blue-gray-500 py-2">{emptyText}</div>
    );
  }

  if (compact) {
    return (
      <ul className="space-y-2">
        {shifts.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm border-b border-blue-gray-50 pb-2 last:border-0">
            <span className="font-medium text-blue-gray-800 min-w-[88px]">
              {formatWorkDateShort(s.workDate?.slice(0, 10))}
            </span>
            <span className="font-semibold text-blue-700">{formatShiftTime(s)}</span>
            <span className="text-blue-gray-600">{s.storeName}</span>
            <Chip
              size="sm"
              color={shiftStatusColor(s.status)}
              value={shiftStatusLabel(s.status)}
              className="normal-case ml-auto"
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      {title ? (
        <Typography variant="small" className="font-semibold text-blue-gray-800 mb-1 block">
          {title}
        </Typography>
      ) : null}
      {subtitle ? (
        <Typography variant="small" color="gray" className="mb-3 block">
          {subtitle}
        </Typography>
      ) : null}
      <ul className="space-y-3">
        {shifts.map((s) => {
          const dateKey = s.workDate?.slice(0, 10);
          return (
            <ShiftRow
              key={s.id}
              shift={s}
              highlight={highlightToday && dateKey === today}
            />
          );
        })}
      </ul>
    </div>
  );
}
