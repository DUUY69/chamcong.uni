import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, Typography, Chip } from "@material-tailwind/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import api from "@/api";

const LEVEL_COLORS = { problem: "red", warning: "amber", ok: "green" };

export default function StoreAttendanceAlerts() {
  const navigate = useNavigate();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/attendance/store-alerts?year=${year}&month=${month}`);
        setRows(res.data.data || []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [year, month]);

  const problemCount = rows.filter((r) => r.alertLevel === "problem").length;
  const warningCount = rows.filter((r) => r.alertLevel === "warning").length;

  const openStore = (storeId) => {
    const lastDay = new Date(year, month, 0).getDate();
    const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
    const dateTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    navigate(`/dashboard/attendance?storeId=${storeId}&flaggedOnly=1&viewMonth=1&date=${dateFrom}`);
  };

  return (
    <Card className="border border-blue-gray-100 mt-4">
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <Typography variant="h6" color="blue-gray">Cảnh báo chấm công theo cửa hàng</Typography>
            <Typography variant="small" color="gray" className="mt-0.5">
              QL sửa giờ nhiều lần khi xác nhận → cờ cảnh báo. CH đỏ cần Admin kiểm tra.
            </Typography>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-blue-gray-200 px-2 py-1.5 text-sm">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
            ))}
          </select>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-blue-gray-200 px-2 py-1.5 text-sm w-20" />
        </div>
      </div>
      <CardBody className="p-0">
        {!loading && (problemCount > 0 || warningCount > 0) && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-sm text-amber-900">
            {problemCount > 0 && <span className="font-medium">{problemCount} CH cần kiểm tra</span>}
            {problemCount > 0 && warningCount > 0 && " · "}
            {warningCount > 0 && <span>{warningCount} CH theo dõi</span>}
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-gray-400 text-sm">Đang tải...</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-sm">Không có dữ liệu cửa hàng</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-gray-50 text-blue-gray-700">
                  <th className="px-4 py-2.5 text-left">Cửa hàng</th>
                  <th className="px-4 py-2.5 text-center">Ca bị cờ</th>
                  <th className="px-4 py-2.5 text-center">Tổng lần sửa</th>
                  <th className="px-4 py-2.5 text-center">Tổng ca</th>
                  <th className="px-4 py-2.5 text-center">Trạng thái</th>
                  <th className="px-4 py-2.5 text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.storeId} className={`${i % 2 === 0 ? "bg-white" : "bg-blue-gray-50/40"} ${r.alertLevel === "problem" ? "ring-1 ring-inset ring-red-100" : ""}`}>
                    <td className="px-4 py-2.5 font-medium">
                      {r.alertLevel === "problem" && <span className="text-red-500 mr-1">⚠</span>}
                      {r.storeName}
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold text-red-600">{r.flaggedCount || "—"}</td>
                    <td className="px-4 py-2.5 text-center">{r.totalEditCount || "—"}</td>
                    <td className="px-4 py-2.5 text-center text-blue-gray-500">{r.totalRecords}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Chip size="sm" color={LEVEL_COLORS[r.alertLevel] || "gray"} value={r.alertLabel} className="normal-case w-fit mx-auto" />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {r.flaggedCount > 0 ? (
                        <button type="button" onClick={() => openStore(r.storeId)}
                          className="text-xs text-blue-600 hover:underline">Xem ca cờ</button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
