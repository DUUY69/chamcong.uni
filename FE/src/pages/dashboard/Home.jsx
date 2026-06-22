import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, Typography, Button, Chip } from "@material-tailwind/react";
import {
  ClockIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  MapPinIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";
import { useAuth } from "@/context/AuthContext";
import api from "@/api";
import { fetchStores } from "@/utils/storesApi";
import { formatMoney, formatHourlyRate } from "@/utils/formatMoney";
import { isActiveShiftStatus, sortShiftsChronologically, formatShiftTime, weekBlockStatus } from "@/utils/shiftFormat";
import StoreAttendanceAlerts from "@/components/StoreAttendanceAlerts";
import OperationsDashboard from "@/components/OperationsDashboard";
import { mergeAdjacentShifts, attendanceForShiftBlock } from "@/utils/mergeAdjacentShifts";
import { getMondayOfWeek, getWeekDates, addDays } from "@/utils/scheduleSlots";

function localTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatWeekRangeLabel(weekDays) {
  if (!weekDays?.length) return "";
  const fmt = (s) =>
    new Date(`${s}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  return `${fmt(weekDays[0])} – ${fmt(weekDays[6])}/${weekDays[0].slice(0, 4)}`;
}

/** Card lịch làm theo tuần — có nút / vuốt xem tuần trước–sau */
function WeekScheduleCard({
  shifts,
  attendances = [],
  weekDays,
  isCurrentWeek,
  loading,
  onPrevWeek,
  onNextWeek,
  onGoCurrentWeek,
}) {
  const navigate = useNavigate();
  const today = localTodayStr();
  const touchStartX = useRef(null);

  const byDay = {};
  for (const s of shifts) {
    const d = s.workDate?.slice(0, 10);
    if (!d) continue;
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(s);
  }

  const hasAny = weekDays.some((d) => byDay[d]?.length > 0);

  const handleTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e) => {
    const start = touchStartX.current;
    const end = e.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (start == null || end == null) return;
    const dx = end - start;
    if (dx > 60) onPrevWeek?.();
    else if (dx < -60) onNextWeek?.();
  };

  return (
    <Card className="border border-blue-gray-100">
      <CardBody className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <Typography variant="h6" color="blue-gray" className="text-base flex items-center gap-2 shrink-0">
            <CalendarDaysIcon className="w-5 h-5 text-blue-600" />
            Lịch làm việc
          </Typography>
          <button
            type="button"
            onClick={() => navigate("/dashboard/shift-registrations")}
            className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline shrink-0"
          >
            Đăng ký ca <ArrowRightIcon className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 mb-3 rounded-xl bg-blue-gray-50/80 border border-blue-gray-100 px-2 py-1.5">
          <button
            type="button"
            aria-label="Tuần trước"
            onClick={onPrevWeek}
            className="p-2 rounded-lg hover:bg-white text-blue-gray-700 shrink-0"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center min-w-0">
            <p className="text-sm font-semibold text-blue-gray-900 truncate">
              {isCurrentWeek ? "Tuần này" : "Tuần"} · {formatWeekRangeLabel(weekDays)}
            </p>
            {!isCurrentWeek && (
              <button
                type="button"
                onClick={onGoCurrentWeek}
                className="text-xs text-blue-600 font-medium hover:underline mt-0.5"
              >
                Về tuần này
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Tuần sau"
            onClick={onNextWeek}
            className="p-2 rounded-lg hover:bg-white text-blue-gray-700 shrink-0"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-blue-gray-400 text-center mb-2 -mt-1">Vuốt trái/phải để đổi tuần</p>

        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {loading ? (
          <p className="text-sm text-gray-400 py-3 text-center">Đang tải...</p>
        ) : !hasAny ? (
          <div className="rounded-xl border border-dashed border-blue-gray-200 bg-blue-gray-50/50 p-4 text-center space-y-2">
            <p className="text-sm text-blue-gray-500">Tuần này chưa có ca nào được duyệt</p>
            <Button size="sm" variant="outlined" color="blue" onClick={() => navigate("/dashboard/shift-registrations")}>
              Đăng ký ca ngay
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {weekDays.map((dateStr) => {
              const rawDay = byDay[dateStr] || [];
              const dayCas = mergeAdjacentShifts(sortShiftsChronologically(rawDay));
              const isToday = dateStr === today;
              const isPast = dateStr < today;
              const dateLabel = new Date(`${dateStr}T00:00:00`).toLocaleDateString("vi-VN", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
              });

              if (dayCas.length === 0) return null;

              return (
                <li
                  key={dateStr}
                  className={`rounded-xl border px-3 py-2.5 ${
                    isToday
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : isPast
                      ? "border-blue-gray-100 bg-blue-gray-50/40 opacity-70"
                      : "border-blue-gray-100 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-blue-700" : "text-blue-gray-500"}`}>
                      {dateLabel}
                    </span>
                    {isToday && (
                      <span className="text-xs bg-blue-600 text-white rounded-full px-2 py-0.5 font-medium">Hôm nay</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {dayCas.map((s) => {
                      const regIds = new Set(s.registrationIds || [s.id]);
                      const blockRegs = rawDay.filter((r) => regIds.has(r.id));
                      const blockStatus = blockRegs.some((r) => r.status === "Pending")
                        ? "Pending"
                        : (blockRegs[0]?.status || s.status);
                      const blockAtt = attendanceForShiftBlock(attendances, s);
                      const status = weekBlockStatus(blockStatus, blockAtt);
                      return (
                      <div key={`${dateStr}-${s.storeId}-${s.startTime}-${s.endTime}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="flex items-center gap-1 font-semibold text-blue-gray-900">
                          <ClockIcon className="w-3.5 h-3.5 text-blue-500" />
                          {formatShiftTime(s)}
                        </span>
                        <span className="flex items-center gap-1 text-blue-gray-600 min-w-0">
                          <BuildingStorefrontIcon className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                          <span className="truncate">{s.storeName}</span>
                        </span>
                        <Chip
                          size="sm"
                          color={status.color}
                          value={status.label}
                          className="normal-case ml-auto shrink-0"
                        />
                      </div>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </CardBody>
    </Card>
  );
}

/** Card lương tháng này */
function SalaryThisMonthCard({ salaryHistory, monthWorkedHours, monthEstimate, loading }) {
  const cur = salaryHistory[0];
  const hourly = cur
    ? Number(cur.baseSalaryPerHour || 0) * Number(cur.coefficient || 1)
    : 0;

  return (
    <Card className="border border-blue-gray-100">
      <CardBody className="p-4">
        <Typography variant="h6" color="blue-gray" className="text-base flex items-center gap-2 mb-3">
          <BanknotesIcon className="w-5 h-5 text-green-600" />
          Lương tháng này
        </Typography>

        {loading ? (
          <p className="text-sm text-gray-400 py-3 text-center">Đang tải...</p>
        ) : (
          <div className="space-y-3">
            {/* Lương dự kiến — số lớn nổi bật */}
            <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 px-4 py-3 text-center">
              <p className="text-xs text-green-700 font-medium mb-0.5">Tổng lương dự kiến</p>
              <p className="text-2xl font-bold text-green-800">
                {monthEstimate != null ? formatMoney(monthEstimate) : "—"}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {monthWorkedHours > 0
                  ? `Dựa trên ${monthWorkedHours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} giờ đã chấm công`
                  : "Chưa có giờ công đã duyệt"}
              </p>
            </div>

            {/* Chi tiết tính */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-blue-gray-100 bg-white px-3 py-2 text-center">
                <p className="text-xs text-blue-gray-500">Giờ đã làm</p>
                <p className="text-lg font-bold text-blue-gray-800">
                  {monthWorkedHours > 0
                    ? `${monthWorkedHours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}h`
                    : "0h"}
                </p>
                <p className="text-xs text-blue-gray-400">đã được duyệt</p>
              </div>
              <div className="rounded-lg border border-blue-gray-100 bg-white px-3 py-2 text-center">
                <p className="text-xs text-blue-gray-500">Đơn giá</p>
                <p className="text-base font-bold text-blue-gray-800">
                  {hourly > 0 ? formatMoney(hourly) : "—"}
                </p>
                <p className="text-xs text-blue-gray-400">mỗi giờ</p>
              </div>
            </div>

            {cur && Number(cur.coefficient) !== 1 && (
              <p className="text-xs text-blue-gray-400 text-center">
                Hệ số: ×{cur.coefficient}
              </p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const { currentUser, isAdmin, isManager, isEmployee, isActingAsEmployee, setWorkMode } = useAuth();
  const [stats, setStats] = useState({ employees: 0, stores: 0 });
  const [weekShifts, setWeekShifts] = useState([]);
  const [weekAttendances, setWeekAttendances] = useState([]);
  const [monthEstimate, setMonthEstimate] = useState(null);
  const [monthWorkedHours, setMonthWorkedHours] = useState(0);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [myToday, setMyToday] = useState(null);
  const [weekMonday, setWeekMonday] = useState(() => getMondayOfWeek(new Date()));
  const [weekLoading, setWeekLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [punching, setPunching] = useState(false);

  const weekDays = useMemo(() => getWeekDates(weekMonday), [weekMonday]);
  const isCurrentWeek = weekMonday === getMondayOfWeek(new Date());

  const goPrevWeek = useCallback(() => setWeekMonday((m) => addDays(m, -7)), []);
  const goNextWeek = useCallback(() => setWeekMonday((m) => addDays(m, 7)), []);
  const goCurrentWeek = useCallback(() => setWeekMonday(getMondayOfWeek(new Date())), []);

  // Admin / Manager: load stats
  useEffect(() => {
    if (isEmployee) return;
    const load = async () => {
      try {
        const [empRes, storeList] = await Promise.all([
          api.get("/employees?isActive=true"),
          fetchStores(api, { isAdmin }),
        ]);
        setStats({
          employees: empRes.data.data?.length || 0,
          stores: storeList.length,
        });
      } catch {}
    };
    load();
  }, [isEmployee, isAdmin]);

  // Employee: lương tháng + chấm công hôm nay
  useEffect(() => {
    if (!isEmployee) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const today = localTodayStr();
    const attParams = new URLSearchParams({ dateFrom: monthStart, dateTo: today });

    (async () => {
      setLoading(true);
      try {
        const [attRes, salRes, myTodayRes] = await Promise.all([
          api.get(`/attendance?${attParams}`),
          api.get("/employees/me/salary-history"),
          api.get(`/attendance/my-today?workDate=${today}`),
        ]);

        const history = salRes.data.data || [];
        setSalaryHistory(history);
        setMyToday(myTodayRes.data.data || null);

        const confirmed = (attRes.data.data || []).filter(
          (a) => a.status === "Worked" && a.reviewStatus === "Confirmed"
        );
        const hours = confirmed.reduce((s, a) => s + Number(a.workedHours || 0), 0);
        setMonthWorkedHours(hours);

        const cur = history[0];
        const hourly = cur
          ? Number(cur.baseSalaryPerHour || 0) * Number(cur.coefficient || 1)
          : 0;
        setMonthEstimate(hourly > 0 ? hours * hourly : null);
      } catch {
        setSalaryHistory([]);
        setMonthEstimate(null);
        setMonthWorkedHours(0);
        setMyToday(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [isEmployee]);

  // Employee: lịch làm theo tuần đang chọn
  useEffect(() => {
    if (!isEmployee) return;
    const weekFrom = weekDays[0];
    const weekTo = weekDays[6];
    const shiftParams = new URLSearchParams({ dateFrom: weekFrom, dateTo: weekTo });
    const weekAttParams = new URLSearchParams({ dateFrom: weekFrom, dateTo: weekTo });

    (async () => {
      setWeekLoading(true);
      try {
        const [shiftRes, weekAttRes] = await Promise.all([
          api.get(`/shift-registrations?${shiftParams}`),
          api.get(`/attendance?${weekAttParams}`),
        ]);
        const rows = (shiftRes.data.data || []).filter((s) => isActiveShiftStatus(s.status));
        setWeekShifts(sortShiftsChronologically(rows));
        setWeekAttendances(weekAttRes.data.data || []);
      } catch {
        setWeekShifts([]);
        setWeekAttendances([]);
      } finally {
        setWeekLoading(false);
      }
    })();
  }, [isEmployee, weekMonday, weekDays]);

  // ── Admin / Manager view ──────────────────────────────────────────────────
  if (isAdmin || isManager) {
    return (
      <div className="mt-4 space-y-4">
        <Typography variant="h5" color="blue-gray">
          Xin chào, {currentUser?.fullName} 👋
        </Typography>

        {isManager && !isActingAsEmployee && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-gray-800">
            Cần <strong>đăng ký ca</strong> hoặc <strong>chấm công</strong> cho bản thân?
            Bấm <strong>Nhân viên</strong> ở sidebar (dưới menu) hoặc <strong>NV</strong> trên thanh header.
            {" "}
            <button type="button" className="font-semibold text-blue-700 underline" onClick={() => setWorkMode("employee")}>
              Chuyển ngay
            </button>
          </div>
        )}

        <OperationsDashboard />

        <details className="rounded-lg border border-blue-gray-100 bg-white">
          <summary className="px-4 py-3 text-sm font-medium text-blue-gray-700 cursor-pointer">
            Tổng quan hệ thống · {stats.employees} NV · {stats.stores} CH
          </summary>
          <div className="px-4 pb-4">
            <StoreAttendanceAlerts />
          </div>
        </details>
      </div>
    );
  }

  // ── Employee view ─────────────────────────────────────────────────────────
  const today = localTodayStr();
  const rawTodayShifts = myToday?.shifts || [];
  const todayShifts = rawTodayShifts[0]?.registrationIds
    ? rawTodayShifts
    : mergeAdjacentShifts(rawTodayShifts);
  const dayAttendances = myToday?.attendances?.length
    ? myToday.attendances
    : (myToday?.attendance ? [myToday.attendance] : []);
  const att = dayAttendances.find((a) => a.reviewStatus === "Open") || myToday?.attendance;

  const handleCheckIn = async (shiftRegistrationId) => {
    if (!shiftRegistrationId) return;
    setPunching(true);
    try {
      await api.post("/attendance/check-in", {
        shiftRegistrationId,
        workDate: today,
      });
      // reload my-today
      const res = await api.get(`/attendance/my-today?workDate=${today}`);
      setMyToday(res.data.data || null);
    } catch (e) {
      alert(e?.response?.data?.message || "Lỗi check-in");
    } finally {
      setPunching(false);
    }
  };

  const handleCheckOut = async (attendanceId) => {
    const targetId = attendanceId || att?.id;
    if (!targetId) return;
    if (!confirm("Kết thúc ca? Giờ sẽ chờ quản lý xác nhận.")) return;
    setPunching(true);
    try {
      await api.post(`/attendance/${targetId}/check-out`);
      const res = await api.get(`/attendance/my-today?workDate=${today}`);
      setMyToday(res.data.data || null);
    } catch (e) {
      alert(e?.response?.data?.message || "Lỗi check-out");
    } finally {
      setPunching(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <Typography variant="h5" color="blue-gray">
        Xin chào, {currentUser?.fullName} 👋
      </Typography>

      {/* ── Chấm công hôm nay ── */}
      <Card className="border border-blue-gray-100">
        <CardBody className="p-4">
          <Typography variant="h6" color="blue-gray" className="text-base flex items-center gap-2 mb-3">
            <ClipboardDocumentCheckIcon className="w-5 h-5 text-orange-500" />
            Chấm công hôm nay
                </Typography>

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-2">Đang tải...</p>
          ) : todayShifts.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
              Hôm nay chưa có ca được duyệt. Vào <strong>Đăng ký ca</strong> để đăng ký ca làm.
            </p>
          ) : (
            <div className="space-y-3">
              {todayShifts.map((block) => {
                const blockAtt = attendanceForShiftBlock(dayAttendances, block);
                return (
                  <div key={block.id} className="rounded-xl border border-blue-gray-100 bg-blue-gray-50/50 px-4 py-3 text-sm space-y-2">
                    <div className="flex flex-wrap gap-3 items-center">
                      <span className="flex items-center gap-1 font-semibold text-blue-gray-900">
                        <ClockIcon className="w-4 h-4 text-blue-500" />
                        {block.startTime} – {block.endTime}
                      </span>
                      <span className="flex items-center gap-1 text-blue-gray-600">
                        <BuildingStorefrontIcon className="w-4 h-4 text-teal-500" />
                        {block.storeName}
                      </span>
              </div>
                    {!blockAtt && (
                      <Button
                        color="green"
                        size="lg"
                        className="w-full normal-case text-base"
                        disabled={punching}
                        onClick={() => handleCheckIn(block.id)}
                      >
                        {punching ? "Đang xử lý..." : "▶ Bắt đầu làm"}
              </Button>
                    )}
                    {blockAtt?.reviewStatus === "Open" && (
                      <div className="space-y-2">
                        <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-green-800 font-medium">
                          ✓ Đang làm · Vào lúc <strong>{blockAtt.actualCheckIn}</strong>
              </div>
                        <Button
                          color="blue"
                          size="lg"
                          className="w-full normal-case text-base"
                          disabled={punching}
                          onClick={() => handleCheckOut(blockAtt.id)}
                        >
                          {punching ? "Đang xử lý..." : "■ Kết thúc ca"}
              </Button>
                      </div>
                    )}
                    {blockAtt?.reviewStatus === "PendingReview" && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800">
                        Đã kết thúc · {blockAtt.actualCheckIn} – {blockAtt.actualCheckOut}
                        <span className="text-xs block">Chờ QL xác nhận.</span>
                      </div>
                    )}
                    {blockAtt?.reviewStatus === "Confirmed" && (
                      <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-green-800">
                        ✓ Đã duyệt công · {blockAtt.checkIn} – {blockAtt.checkOut} · <strong>{Number(blockAtt.workedHours).toFixed(1)}h</strong>
                      </div>
                    )}
              </div>
                );
              })}
      </div>
            )}
          </CardBody>
        </Card>

      {/* Lịch làm tuần này */}
      <WeekScheduleCard
        shifts={weekShifts}
        attendances={weekAttendances}
        weekDays={weekDays}
        isCurrentWeek={isCurrentWeek}
        loading={weekLoading}
        onPrevWeek={goPrevWeek}
        onNextWeek={goNextWeek}
        onGoCurrentWeek={goCurrentWeek}
      />

      {/* Lương tháng này */}
      <SalaryThisMonthCard
        salaryHistory={salaryHistory}
        monthWorkedHours={monthWorkedHours}
        monthEstimate={monthEstimate}
        loading={loading}
      />
    </div>
  );
}
