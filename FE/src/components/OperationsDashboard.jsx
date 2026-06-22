import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, Typography, Chip } from "@material-tailwind/react";
import {
  UserGroupIcon,
  CheckCircleIcon,
  ClockIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
} from "@heroicons/react/24/solid";
import api from "@/api";
import { fetchStores } from "@/utils/storesApi";
import { formatMoney } from "@/utils/formatMoney";
import { formatDateVi } from "@/utils/dates";
import { useAuth } from "@/context/AuthContext";

function localTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function KpiCard({ icon, label, value, sub, color = "blue" }) {
  const bg = { blue: "bg-blue-50", green: "bg-green-50", amber: "bg-amber-50", red: "bg-red-50", purple: "bg-purple-50" };
  const ic = { blue: "text-blue-600", green: "text-green-600", amber: "text-amber-600", red: "text-red-600", purple: "text-purple-600" };
  return (
    <Card className="border border-blue-gray-100 shadow-sm">
      <CardBody className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${bg[color]}`}>{icon}</div>
        <div className="min-w-0">
          <Typography variant="small" className="text-blue-gray-500 text-xs">{label}</Typography>
          <Typography variant="h5" className="text-blue-gray-900 font-bold">{value}</Typography>
          {sub && <Typography variant="small" className="text-blue-gray-400 text-[10px]">{sub}</Typography>}
        </div>
      </CardBody>
    </Card>
  );
}

function AlertLevel({ level }) {
  const cls = {
    ok: "bg-green-500",
    info: "bg-blue-500",
    warning: "bg-amber-500",
    problem: "bg-red-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 mt-1 ${cls[level] || "bg-gray-400"}`} />;
}

function TrendChart({ days = [] }) {
  const max = Math.max(1, ...days.map((d) => d.present + d.absent));
  return (
    <div className="flex items-end gap-1.5 h-28 pt-2">
      {days.map((d) => {
        const h = Math.round((d.present / max) * 100);
        const label = d.date?.slice(8, 10) || "";
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="w-full flex flex-col justify-end h-20 bg-blue-gray-50 rounded-t-md overflow-hidden">
              <div className="bg-blue-500 rounded-t-md transition-all" style={{ height: `${h}%`, minHeight: d.present ? 4 : 0 }} title={`${d.present} có mặt`} />
            </div>
            <span className="text-[9px] text-blue-gray-500">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function OperationsDashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [workDate, setWorkDate] = useState(localTodayStr());
  const [storeId, setStoreId] = useState("");
  const [stores, setStores] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStores(api, { isAdmin }).then(setStores).catch(() => setStores([]));
  }, [isAdmin]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ workDate });
        if (storeId) params.set("storeId", storeId);
        const res = await api.get(`/dashboard/operations?${params}`);
        setData(res.data.data || null);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [workDate, storeId]);

  const kpi = data?.kpi || {};
  const labor = data?.labor || {};
  const score = data?.storeScore;

  const scoreStyle = useMemo(() => {
    if (!score) return { card: "border-blue-gray-200 bg-white", text: "text-blue-gray-700" };
    if (score.score >= 80) return { card: "border-green-300 bg-green-50/40", text: "text-green-700" };
    if (score.score >= 60) return { card: "border-amber-300 bg-amber-50/40", text: "text-amber-700" };
    return { card: "border-red-300 bg-red-50/40", text: "text-red-700" };
  }, [score]);

  if (loading && !data) {
    return <p className="py-16 text-center text-gray-400 text-sm">Đang tải dashboard...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography variant="h6" className="text-blue-gray-900">Vận hành hôm nay</Typography>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)}
            className="rounded-lg border border-blue-gray-200 px-2 py-1.5 text-sm" />
          {(isAdmin || stores.length > 1) && (
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)}
              className="rounded-lg border border-blue-gray-200 px-2 py-1.5 text-sm bg-white max-w-[200px]">
              <option value="">{isAdmin ? "Tất cả CH" : "Tất cả CH của tôi"}</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button type="button" onClick={() => navigate(`/dashboard/attendance?date=${workDate}`)}
            className="text-xs text-blue-600 font-medium hover:underline">
            Chi tiết chấm công →
          </button>
        </div>
      </div>

      {/* 1. KPI hàng trên */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={<UserGroupIcon className={`w-6 h-6 text-blue-600`} />} label="NV ca hôm nay" value={kpi.totalScheduled ?? 0} color="blue" />
        <KpiCard icon={<CheckCircleIcon className="w-6 h-6 text-green-600" />} label="Đã check-in" value={kpi.checkedIn ?? 0} color="green" />
        <KpiCard icon={<ClockIcon className="w-6 h-6 text-amber-600" />} label="Đi trễ" value={kpi.late ?? 0} color="amber" />
        <KpiCard icon={<CalendarDaysIcon className="w-6 h-6 text-red-600" />} label="Nghỉ / vắng" value={kpi.onLeave ?? 0} color="red" />
        <KpiCard icon={<BanknotesIcon className="w-6 h-6 text-purple-600" />} label="CP nhân công" value={formatMoney(kpi.todayLaborCost ?? 0)} sub="dự kiến ca duyệt" color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 2. Trái — cảnh báo + chưa check-in */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border border-blue-gray-100">
            <CardBody className="p-4">
              <Typography variant="small" className="font-bold text-blue-gray-900 flex items-center gap-1.5 mb-3">
                <ExclamationTriangleIcon className="w-4 h-4 text-amber-600" /> Cảnh báo
              </Typography>
              <ul className="space-y-2">
                {(data?.alerts || []).map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-blue-gray-700">
                    <AlertLevel level={a.level} />
                    <span>{a.storeName ? `${a.storeName}: ` : ""}{a.message}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card className="border border-blue-gray-100">
            <CardBody className="p-4">
              <Typography variant="small" className="font-bold text-blue-gray-900 mb-2">
                Chưa check-in ({data?.missingCheckIn?.length || 0})
              </Typography>
              {(data?.missingCheckIn || []).length === 0 ? (
                <p className="text-xs text-green-700">Tất cả NV đã chấm hoặc chưa tới giờ ca.</p>
              ) : (
                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                  {data.missingCheckIn.map((m) => (
                    <li key={`${m.employeeId}-${m.scheduledStart}`} className="text-xs border-b border-blue-gray-50 pb-1.5">
                      <span className="font-semibold text-blue-gray-900">{m.employeeName}</span>
                      <span className="text-blue-gray-500 block">{m.storeName} · {m.scheduledStart}–{m.scheduledEnd}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* 3. Giữa — timeline + đang làm */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border border-blue-gray-100">
            <CardBody className="p-4">
              <Typography variant="small" className="font-bold text-blue-gray-900 mb-3">Timeline ca làm — {formatDateVi(workDate)}</Typography>
              {(data?.shiftTimeline || []).length === 0 ? (
                <p className="text-xs text-gray-400">Không có ca đã duyệt.</p>
              ) : (
                <div className="space-y-2">
                  {data.shiftTimeline.map((t) => (
                    <div key={`${t.start}-${t.end}`} className="flex items-center gap-3 text-xs">
                      <span className="font-mono font-semibold text-blue-gray-800 w-24 shrink-0">{t.start}–{t.end}</span>
                      <div className="flex-1 h-2 bg-blue-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${t.scheduledCount ? (t.checkedInCount / t.scheduledCount) * 100 : 0}%` }} />
                      </div>
                      <span className="text-blue-gray-600 shrink-0">{t.checkedInCount}/{t.scheduledCount} vào</span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card className="border border-blue-gray-100">
            <CardBody className="p-4">
              <Typography variant="small" className="font-bold text-blue-gray-900 mb-2">
                Đang làm ({data?.currentlyWorking?.length || 0})
              </Typography>
              {(data?.currentlyWorking || []).length === 0 ? (
                <p className="text-xs text-gray-400">Không có NV đang trong ca.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.currentlyWorking.map((w) => (
                    <li key={w.employeeId} className="flex justify-between text-xs">
                      <span className="font-medium">{w.employeeName}</span>
                      <span className="text-blue-gray-500">{w.storeName} · từ {w.since} → {w.scheduledEnd}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* 4. Phải — chi phí + đủ ca + điểm CH */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border border-blue-gray-100">
            <CardBody className="p-4 space-y-3">
              <Typography variant="small" className="font-bold text-blue-gray-900">Chi phí & nhân sự</Typography>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-purple-50 px-3 py-2">
                  <p className="text-purple-700">Dự kiến</p>
                  <p className="font-bold text-purple-900">{formatMoney(labor.estimatedPay ?? 0)}</p>
                </div>
                <div className="rounded-lg bg-green-50 px-3 py-2">
                  <p className="text-green-700">Đã xác nhận</p>
                  <p className="font-bold text-green-900">{formatMoney(labor.confirmedPay ?? 0)}</p>
                </div>
                <div className="rounded-lg bg-amber-50 px-3 py-2">
                  <p className="text-amber-700">OT hôm nay</p>
                  <p className="font-bold text-amber-900">{Number(labor.overtimeHours ?? 0).toFixed(1)}h</p>
                </div>
                <div className="rounded-lg bg-blue-50 px-3 py-2">
                  <p className="text-blue-700">Đủ ca</p>
                  <p className="font-bold text-blue-900">{labor.approvedStaff ?? 0}/{labor.requiredStaff ?? 0}</p>
                  <p className="text-[10px] text-blue-600">{labor.staffingFulfillmentPct ?? 0}%</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {score && (
            <Card className={`border-2 ${scoreStyle.card}`}>
              <CardBody className="p-4 text-center">
                <Typography variant="small" className="font-bold text-blue-gray-800 mb-1">Điểm chấm công CH</Typography>
                <p className={`text-4xl font-black ${scoreStyle.text}`}>{score.score}</p>
                <p className="text-[10px] text-blue-gray-500 mt-1">7 ngày gần nhất · thang 0–100</p>
                <div className="grid grid-cols-2 gap-1 mt-3 text-[10px] text-left">
                  <span>Đúng giờ: {score.onTimeRate}%</span>
                  <span>Đủ ca: {score.staffingRate}%</span>
                  <span>OT: {score.overtimeRate}%</span>
                  <span>Vắng: {score.absenceRate}%</span>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* 5. Dưới — 7 ngày + top */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-blue-gray-100 md:col-span-1">
          <CardBody className="p-4">
            <Typography variant="small" className="font-bold text-blue-gray-900 flex items-center gap-1.5 mb-2">
              <ChartBarIcon className="w-4 h-4 text-blue-600" /> Chuyên cần 7 ngày
            </Typography>
            <TrendChart days={data?.last7Days || []} />
            <p className="text-[10px] text-blue-gray-400 mt-2">Cột xanh = số ca có mặt / ngày</p>
          </CardBody>
        </Card>

        <Card className="border border-blue-gray-100">
          <CardBody className="p-4">
            <Typography variant="small" className="font-bold text-green-800 mb-2">Top chuyên cần</Typography>
            {(data?.topDiligent || []).length === 0 ? (
              <p className="text-xs text-gray-400">Chưa đủ dữ liệu 7 ngày.</p>
            ) : (
              <ol className="space-y-1.5">
                {data.topDiligent.map((e, i) => (
                  <li key={e.employeeId} className="flex justify-between text-xs">
                    <span>{i + 1}. {e.employeeName}</span>
                    <Chip size="sm" color="green" value={e.label} className="normal-case" />
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>

        <Card className="border border-blue-gray-100">
          <CardBody className="p-4">
            <Typography variant="small" className="font-bold text-red-800 mb-2">Top vi phạm</Typography>
            {(data?.topViolations || []).length === 0 ? (
              <p className="text-xs text-gray-400">Không có vi phạm nổi bật.</p>
            ) : (
              <ol className="space-y-1.5">
                {data.topViolations.map((e, i) => (
                  <li key={e.employeeId} className="flex justify-between text-xs">
                    <span>{i + 1}. {e.employeeName}</span>
                    <Chip size="sm" color="red" value={e.label} className="normal-case" />
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
