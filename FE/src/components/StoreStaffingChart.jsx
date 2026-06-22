import { useMemo, useState } from "react";
import { Card, CardBody, Typography } from "@material-tailwind/react";
import { ChartBarIcon } from "@heroicons/react/24/solid";
import {
  buildStoreStaffingForDate,
  buildStoreStaffingWeek,
  dayMonthShort,
  getWeekDatesFromMonday,
  weekdayShort,
} from "@/utils/storeStaffing";
import { formatWorkDateLabel } from "@/utils/shiftFormat";

function intensityClass(count, max) {
  if (count <= 0) return "bg-blue-gray-100 text-blue-gray-400";
  const ratio = count / max;
  if (ratio >= 0.75) return "bg-green-600 text-white font-bold";
  if (ratio >= 0.5) return "bg-green-500 text-white font-semibold";
  if (ratio >= 0.25) return "bg-green-300 text-green-900";
  return "bg-green-100 text-green-800";
}

/** Biểu đồ số NV làm việc theo cửa hàng — hỗ trợ QL sắp xếp ca. */
export default function StoreStaffingChart({
  regs = [],
  stores = [],
  employees = [],
  loading = false,
  scopeLabel = "tất cả CH",
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [chartDate, setChartDate] = useState(today);
  const [mode, setMode] = useState("day");

  const weekDates = useMemo(
    () => getWeekDatesFromMonday(new Date(`${chartDate}T00:00:00`)),
    [chartDate]
  );

  const dayStats = useMemo(
    () => buildStoreStaffingForDate(regs, stores, employees, chartDate),
    [regs, stores, employees, chartDate]
  );

  const weekStats = useMemo(
    () => buildStoreStaffingWeek(regs, stores, weekDates),
    [regs, stores, weekDates]
  );

  const totalApprovedToday = dayStats.rows.reduce((s, r) => s + r.approvedCount, 0);
  const totalPendingToday = dayStats.rows.reduce((s, r) => s + r.pendingCount, 0);

  return (
    <Card className="border border-teal-100 bg-teal-50/20 mb-4 shadow-sm">
      <CardBody className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-2">
            <ChartBarIcon className="w-6 h-6 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <Typography variant="h6" color="blue-gray" className="text-base">
                Nhân sự theo cửa hàng
              </Typography>
              <Typography variant="small" color="gray" className="mt-0.5 block max-w-xl">
                Số nhân viên có ca <strong>đã duyệt</strong> / <strong>chờ duyệt</strong> so với tổng NV gán CH — giúp QL biết CH nào thiếu / thừa người.
              </Typography>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-teal-200 overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setMode("day")}
                className={`px-3 py-1.5 text-xs font-medium ${mode === "day" ? "bg-teal-600 text-white" : "text-blue-gray-600"}`}
              >
                Theo ngày
              </button>
              <button
                type="button"
                onClick={() => setMode("week")}
                className={`px-3 py-1.5 text-xs font-medium ${mode === "week" ? "bg-teal-600 text-white" : "text-blue-gray-600"}`}
              >
                Theo tuần
              </button>
            </div>
            <input
              type="date"
              value={chartDate}
              onChange={(e) => setChartDate(e.target.value)}
              className="rounded-lg border border-teal-200 bg-white px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Đang tải...</p>
        ) : mode === "day" ? (
          <>
            <div className="flex flex-wrap gap-3 mb-4 text-xs">
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                {totalApprovedToday} NV đã duyệt ({scopeLabel})
              </span>
              {totalPendingToday > 0 ? (
                <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                  {totalPendingToday} NV chờ duyệt
                </span>
              ) : null}
              <span className="text-blue-gray-500 self-center">
                {formatWorkDateLabel(chartDate)}
              </span>
            </div>

            <div className="flex flex-wrap gap-4 mb-3 text-[10px] text-blue-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Đã duyệt</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Chờ duyệt</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-blue-gray-400 inline-block" /> NV gán CH (tối đa)</span>
            </div>

            {dayStats.rows.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Chưa có dữ liệu cửa hàng.</p>
            ) : (
              <ul className="space-y-4">
                {dayStats.rows.map((row) => {
                  const scheduled = row.approvedCount + row.pendingCount;
                  const scale = dayStats.maxBar;
                  const approvedW = (row.approvedCount / scale) * 100;
                  const pendingW = (row.pendingCount / scale) * 100;
                  const assignedW = (row.assignedCount / scale) * 100;
                  const understaffed = row.approvedCount === 0 && row.assignedCount > 0;
                  const lowStaff = row.approvedCount > 0 && row.approvedCount < Math.ceil(row.assignedCount / 2);

                  return (
                    <li key={row.storeId}>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <Typography variant="small" className="font-semibold text-blue-gray-900">
                          {row.storeName}
                          {understaffed ? (
                            <span className="ml-2 text-[10px] font-bold text-red-600 uppercase">Chưa có ca</span>
                          ) : lowStaff ? (
                            <span className="ml-2 text-[10px] font-bold text-amber-700">Thiếu người</span>
                          ) : null}
                        </Typography>
                        <Typography variant="small" className="text-xs text-blue-gray-600">
                          <strong className="text-green-700">{row.approvedCount}</strong> duyệt
                          {row.pendingCount > 0 ? (
                            <> · <strong className="text-amber-700">{row.pendingCount}</strong> chờ</>
                          ) : null}
                          {" · "}
                          <span className="text-blue-gray-500">{row.assignedCount} NV gán CH</span>
                        </Typography>
                      </div>
                      <div className="relative h-7 bg-blue-gray-100 rounded-lg overflow-hidden">
                        {row.assignedCount > 0 ? (
                          <div
                            className="absolute inset-y-0 left-0 border-r-2 border-dashed border-blue-gray-400 pointer-events-none z-[1]"
                            style={{ width: `${Math.min(assignedW, 100)}%` }}
                            title={`${row.assignedCount} NV gán cửa hàng`}
                          />
                        ) : null}
                        <div className="absolute inset-y-0 left-0 flex">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${approvedW}%` }}
                            title={`${row.approvedCount} NV đã duyệt`}
                          />
                          <div
                            className="h-full bg-amber-400 transition-all"
                            style={{ width: `${pendingW}%` }}
                            title={`${row.pendingCount} NV chờ duyệt`}
                          />
                        </div>
                      </div>
                      {scheduled === 0 && row.assignedCount > 0 ? (
                        <p className="text-[10px] text-red-500 mt-1">Cần sắp ca — chưa ai đăng ký / duyệt ngày này.</p>
                      ) : row.gap > 0 && row.approvedCount > 0 ? (
                        <p className="text-[10px] text-blue-gray-500 mt-1">
                          Còn {row.gap} NV gán CH chưa có ca duyệt.
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <>
            <Typography variant="small" color="gray" className="mb-3 block text-xs">
              Tuần {dayMonthShort(weekDates[0])} – {dayMonthShort(weekDates[6])}: số NV <strong>đã duyệt</strong> mỗi ngày (ô đậm = nhiều người).
            </Typography>
            {weekStats.rows.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Chưa có dữ liệu.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[520px]">
                  <thead>
                    <tr className="text-blue-gray-500">
                      <th className="text-left py-2 pr-2 font-medium">Cửa hàng</th>
                      {weekStats.weekDates.map((d) => (
                        <th key={d} className="text-center py-2 px-0.5 font-medium w-11">
                          <div>{weekdayShort(d)}</div>
                          <div className="text-[10px] font-normal">{dayMonthShort(d)}</div>
                        </th>
                      ))}
                      <th className="text-center py-2 pl-1 font-medium w-10">Σ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekStats.rows.map((row) => (
                      <tr key={row.storeId} className="border-t border-teal-100/80">
                        <td className="py-2 pr-2 font-medium text-blue-gray-800 max-w-[120px] truncate" title={row.storeName}>
                          {row.storeName}
                        </td>
                        {row.days.map((cell) => (
                          <td key={cell.date} className="py-1 px-0.5 text-center">
                            <div
                              className={`mx-auto w-9 h-9 rounded-lg flex items-center justify-center text-xs ${intensityClass(cell.approvedCount, weekStats.maxCell)}`}
                              title={`${cell.approvedCount} NV · ${cell.shiftCount} ca`}
                            >
                              {cell.approvedCount || "—"}
                            </div>
                          </td>
                        ))}
                        <td className="py-2 text-center font-bold text-teal-800">{row.weekTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
