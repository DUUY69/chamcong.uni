import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useSortableTable } from "@/hooks/useSortableTable";
import SortIcon from "@/components/SortIcon";
import { Card, CardBody, Typography, Button, Chip } from "@material-tailwind/react";
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { formatDateVi } from "@/utils/dates";
import { mergeAdjacentShifts, mergeDayBoardRows, attendanceForShiftBlock } from "@/utils/mergeAdjacentShifts";
import { MobileCard, MobileListShell, MobileRow } from "@/components/mobile/MobileCard";
import AttendanceReviewModal from "@/components/AttendanceReviewModal";
import AttendanceManualModal from "@/components/AttendanceManualModal";
import AttendanceManagerDayTable from "@/components/AttendanceManagerDayTable";
import { useUrlFilters } from "@/utils/urlFilters";

const ATTENDANCE_FILTER_DEFAULTS = {
  date: "",
  storeId: "",
  flaggedOnly: "",
  viewMonth: "",
};

const statusColors = { Worked: "green", Absent: "red" };
const reviewColors = { Open: "blue", PendingReview: "amber", Confirmed: "green" };
function localTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Attendance() {
  const { isAdmin, isManager, isEmployee, isActingAsEmployee } = useAuth();
  const canViewOps = (isAdmin || isManager) && !isActingAsEmployee;
  const canOperate = isManager && !isActingAsEmployee;
  const showEmployeePunch = isEmployee || isActingAsEmployee;
  const [searchParams] = useSearchParams();
  const { values, setFilter, setFilters } = useUrlFilters(ATTENDANCE_FILTER_DEFAULTS);
  const filterDate = values.date || searchParams.get("dateFrom") || localTodayStr();
  const filterStore = values.storeId;
  const flaggedOnly = values.flaggedOnly === "1" || values.flaggedOnly === "true";
  const viewMonth = values.viewMonth === "1" || values.viewMonth === "true";

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [pendingReview, setPendingReview] = useState([]);
  const [dayBoard, setDayBoard] = useState([]);
  const [myToday, setMyToday] = useState(null);
  const [punching, setPunching] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [eodLoading, setEodLoading] = useState(false);
  const [manualRow, setManualRow] = useState(null);

  const monthRange = (isoDate) => {
    const [y, m] = isoDate.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return {
      from: `${y}-${String(m).padStart(2, "0")}-01`,
      to: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
    };
  };

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDate) {
        const { from, to } = viewMonth ? monthRange(filterDate) : { from: filterDate, to: filterDate };
        params.set("dateFrom", from);
        params.set("dateTo", to);
      }
      if (filterStore) params.set("storeId", filterStore);
      if (canViewOps && flaggedOnly) params.set("flaggedOnly", "true");

      const reqs = [
        api.get(`/attendance?${params}`),
        canViewOps ? api.get(isAdmin ? "/stores" : "/stores/assigned") : Promise.resolve({ data: { data: [] } }),
        // Admin không cần pending-review và day-board — chỉ Manager mới duyệt
        canOperate && !viewMonth
          ? api.get(`/attendance/pending-review?workDate=${filterDate}${filterStore ? `&storeId=${filterStore}` : ""}`)
          : Promise.resolve({ data: { data: [] } }),
        canOperate && !viewMonth
          ? api.get(`/attendance/manager-day-board?workDate=${filterDate}${filterStore ? `&storeId=${filterStore}` : ""}`)
          : Promise.resolve({ data: { data: [] } }),
        showEmployeePunch && !viewMonth
          ? api.get(`/attendance/my-today?workDate=${filterDate}`)
          : Promise.resolve({ data: { data: null } }),
      ];
      const results = await Promise.all(reqs);
      setRecords(results[0].data.data || []);
      setStores(results[1].data.data || []);
      setPendingReview(results[2].data.data || []);
      setDayBoard(results[3].data.data || []);
      setMyToday(results[4].data.data || null);
    } catch {} finally { if (!silent) setLoading(false); }
  }, [filterDate, filterStore, viewMonth, canViewOps, isAdmin, flaggedOnly, showEmployeePunch, canOperate]);

  useEffect(() => { load(); }, [load]);

  const { sorted, sortKey, sortDir, handleSort } = useSortableTable(records);
  const showManagerDayTable = canOperate && !viewMonth;

  const mergedDayBoard = useMemo(() => mergeDayBoardRows(dayBoard), [dayBoard]);

  const pendingByAttId = useMemo(() => {
    const m = new Map();
    for (const r of pendingReview) m.set(r.id, r);
    return m;
  }, [pendingReview]);

  const openConfirmForRow = (row) => {
    const rec = row.attendanceId ? pendingByAttId.get(row.attendanceId) : null;
    if (!rec) return;
    const idx = pendingReview.findIndex((r) => r.id === rec.id);
    setReviewIndex(idx >= 0 ? idx : 0);
    setReviewModalOpen(true);
  };

  const handleCheckIn = async (shiftRegistrationId) => {
    setPunching(true);
    try {
      await api.post("/attendance/check-in", { shiftRegistrationId, workDate: filterDate });
      load();
    } catch (e) {
      alert(e?.response?.data?.message || "Lỗi");
    } finally {
      setPunching(false);
    }
  };

  const handleCheckOut = async (id) => {
    if (!confirm("Kết thúc ca? Giờ sẽ chờ quản lý xác nhận.")) return;
    setPunching(true);
    try {
      await api.post(`/attendance/${id}/check-out`);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || "Lỗi");
    } finally {
      setPunching(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Xóa bản ghi chấm công?")) return;
    try { await api.delete(`/attendance/${id}`); load({ silent: true }); }
    catch (e) { alert(e?.response?.data?.message || "Lỗi"); }
  };

  const handleEndOfDay = async () => {
    if (!confirm(`Xác nhận tất cả ${pendingReview.length} ca chờ?\nDùng giờ NV bấm thực tế.`)) return;
    setEodLoading(true);
    try {
      const res = await api.post("/attendance/end-of-day-confirm", {
        workDate: filterDate,
        storeId: filterStore ? Number(filterStore) : undefined,
      });
      alert(res.data.message || "Đã xác nhận cuối ngày");
      load({ silent: true });
    } catch (e) {
      alert(e?.response?.data?.message || "Lỗi");
    } finally {
      setEodLoading(false);
    }
  };

  const handleMarkAbsentShift = async (shiftRegistrationId, name) => {
    if (!confirm(`Ghi ${name} VẮNG ngày ${formatDateVi(filterDate)}?`)) return;
    try {
      await api.post(`/attendance/mark-absent-shift/${shiftRegistrationId}`, { workDate: filterDate });
      load({ silent: true });
    } catch (e) {
      alert(e?.response?.data?.message || "Lỗi");
    }
  };

  const statusLabel = (r) => r.statusLabel || (r.status === "Worked" ? "Đi làm" : r.status === "Absent" ? "Không đi làm" : r.status || "—");
  const todayIso = localTodayStr();
  const goToday = () => { setFilters({ viewMonth: "", date: todayIso }); };
  const isTodayView = !viewMonth && filterDate === todayIso;

  const rawShifts = myToday?.shifts || [];
  const shifts = rawShifts[0]?.registrationIds
    ? rawShifts
    : mergeAdjacentShifts(rawShifts);
  const dayAttendances = myToday?.attendances?.length
    ? myToday.attendances
    : (myToday?.attendance ? [myToday.attendance] : []);
  const att = dayAttendances.find((a) => a.reviewStatus === "Open") || myToday?.attendance;

  return (
    <div className="mt-4">
      <Card className="border border-blue-gray-100">
        <div className="p-4 border-b">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Typography variant="h6" color="blue-gray">
                {showEmployeePunch ? "Chấm công" : isAdmin ? "Theo dõi chấm công" : "Chấm công"}
              </Typography>
              {filterDate && (
                <Typography variant="small" className="text-blue-gray-500 font-normal">
                  {viewMonth
                    ? `Tháng ${filterDate.slice(5, 7)}/${filterDate.slice(0, 4)}`
                    : `Ngày ${formatDateVi(filterDate)}`}
                </Typography>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={filterDate} onChange={(e) => setFilters({ date: e.target.value, viewMonth: "" })}
                className="rounded-lg border border-blue-gray-200 px-2 py-2 text-sm" />
              {!viewMonth && filterDate !== todayIso && (
                <Button size="sm" variant="text" className="text-blue-600" onClick={goToday}>Hôm nay</Button>
              )}
              <label className="flex items-center gap-1.5 text-sm text-blue-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={viewMonth} onChange={(e) => setFilter("viewMonth", e.target.checked ? "1" : "")}
                  className="rounded border-blue-gray-300" />
                Cả tháng
              </label>
              {canViewOps && (
                <select value={filterStore} onChange={(e) => setFilter("storeId", e.target.value)}
                  className="rounded-lg border border-blue-gray-200 px-2 py-2 text-sm">
                  <option value="">Tất cả cửa hàng</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {canViewOps && (
                <label className="flex items-center gap-1.5 text-sm text-red-700 cursor-pointer select-none">
                  <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFilter("flaggedOnly", e.target.checked ? "1" : "")}
                    className="rounded border-red-300" />
                  CH có cảnh báo
                </label>
              )}
            </div>
          </div>
        </div>

        <CardBody className="p-0">
          {showEmployeePunch && isTodayView && (
            <div className="px-4 py-4 border-b bg-gradient-to-r from-green-50 to-white">
              <Typography variant="small" className="font-semibold text-blue-gray-800 mb-1">Tự chấm công hôm nay</Typography>
              <Typography variant="small" className="text-blue-gray-500 text-xs mb-3 block">
                Tới ca bấm <strong>Bắt đầu làm</strong>, tan ca bấm <strong>Kết thúc</strong>. QL xác nhận giờ cuối ngày.
              </Typography>
              {shifts.length === 0 ? (
                <Typography variant="small" className="text-amber-800">
                  Chưa có ca <strong>đã duyệt</strong>. Đăng ký ca 06:00–14:00 hoặc 14:00–22:00 tại <strong>Lịch làm</strong> và chờ QL duyệt.
                </Typography>
              ) : (
                <div className="space-y-3">
                  {shifts.map((block) => {
                    const blockAtt = attendanceForShiftBlock(dayAttendances, block);
                    return (
                      <div key={block.id} className="rounded-lg border border-green-200 bg-white px-3 py-3 text-sm space-y-2">
                        <div className="font-medium">{block.storeName}</div>
                        <div className="text-blue-gray-600">Ca đăng ký: {block.startTime} – {block.endTime}</div>
                        {!blockAtt && (
                          <Button color="green" size="md" className="w-full normal-case" disabled={punching}
                            onClick={() => handleCheckIn(block.id)}>
                            {punching ? "Đang xử lý..." : "Bắt đầu làm"}
                          </Button>
                        )}
                        {blockAtt?.reviewStatus === "Open" && (
                          <div className="space-y-2">
                            <Typography variant="small" className="text-green-700 font-medium">
                              ✓ Đang ca · vào lúc {blockAtt.actualCheckIn}
                            </Typography>
                            <Button color="blue" size="md" className="w-full normal-case" disabled={punching}
                              onClick={() => handleCheckOut(blockAtt.id)}>
                              Kết thúc ca
                            </Button>
                          </div>
                        )}
                        {blockAtt?.reviewStatus === "PendingReview" && (
                          <Typography variant="small" className="text-amber-800 bg-amber-50 rounded-lg p-2">
                            Đã kết thúc ({blockAtt.actualCheckIn}–{blockAtt.actualCheckOut}) — chờ QL xác nhận.
                          </Typography>
                        )}
                        {blockAtt?.reviewStatus === "Confirmed" && (
                          <Typography variant="small" className="text-green-800 bg-green-50 rounded-lg p-2">
                            QL đã duyệt: {blockAtt.checkIn}–{blockAtt.checkOut} ({Number(blockAtt.workedHours).toFixed(1)}h)
                          </Typography>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {showEmployeePunch && !viewMonth && !isTodayView && (
            <div className="px-4 py-3 border-b bg-blue-gray-50 text-sm text-blue-gray-600">
              Chọn <strong>Hôm nay</strong> để bấm chấm công. Ngày khác chỉ xem lịch sử.
            </div>
          )}

          {canViewOps && isAdmin && !viewMonth && (
            <div className="px-4 py-2 border-b bg-blue-gray-50 text-xs text-blue-gray-600">
              Admin chỉ xem giám sát — QL cửa hàng thực hiện xác nhận chấm công.
            </div>
          )}

          {/* Chỉ Manager: hướng dẫn + day board + pending review */}
          {showManagerDayTable && (
            <AttendanceManagerDayTable
              workDate={filterDate}
              rows={mergedDayBoard}
              pendingCount={pendingReview.length}
              loading={loading}
              eodLoading={eodLoading}
              onConfirmRow={openConfirmForRow}
              onManualRecord={(row) => setManualRow(row)}
              onEditConfirmed={(row) => setManualRow({ ...row, editMode: true })}
              onMarkAbsent={(row) => handleMarkAbsentShift(row.shiftRegistrationId, row.employeeName)}
              onEndOfDay={handleEndOfDay}
              onDelete={handleDelete}
            />
          )}

          {!showManagerDayTable && (
          <MobileListShell
            loading={loading}
            empty={!loading && records.length === 0}
            emptyText={
              viewMonth
                ? `Chưa có chấm công trong tháng ${filterDate?.slice(5, 7)}/${filterDate?.slice(0, 4)}.`
                : `Chưa có chấm công ngày ${formatDateVi(filterDate)}.`
            }
            count={records.length}
          >
            {records.map((r) => (
              <MobileCard key={r.id}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Typography variant="small" className="font-semibold">{r.employeeName}</Typography>
                  {r.flaggedForReview && <Chip size="sm" color="red" value="⚠" className="px-1" />}
                </div>
                <Typography variant="small" color="gray" className="text-xs font-mono">{r.employeeCode}</Typography>
                <MobileRow label="Cửa hàng">{r.storeName}</MobileRow>
                <MobileRow label="Ngày">{formatDateVi(r.workDate?.slice(0, 10))}</MobileRow>
                {r.status === "Worked" && (
                  <>
                    {r.actualCheckIn && <MobileRow label="NV bấm">{r.actualCheckIn}–{r.actualCheckOut || "…"}</MobileRow>}
                    <MobileRow label="Giờ duyệt">{r.checkIn}–{r.checkOut || "—"}</MobileRow>
                    <MobileRow label="Số giờ">{Number(r.workedHours).toFixed(1)}h</MobileRow>
                  </>
                )}
                <MobileRow label="Trạng thái">
                  <Chip size="sm" color={statusColors[r.status] || "gray"} value={statusLabel(r)} className="w-fit ml-auto normal-case" />
                </MobileRow>
                {r.reviewStatus && (
                  <MobileRow label="Duyệt">
                    <Chip size="sm" color={reviewColors[r.reviewStatus] || "gray"}
                      value={r.reviewStatusLabel || r.reviewStatus} className="w-fit ml-auto normal-case" />
                  </MobileRow>
                )}
                {canOperate && (
                  <button type="button" onClick={() => handleDelete(r.id)} className="text-xs text-red-500 font-medium pt-1 border-t border-blue-gray-100 w-full text-left">
                    Xóa
                  </button>
                )}
              </MobileCard>
            ))}
          </MobileListShell>
          )}

          {!showManagerDayTable && (
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="px-4 py-2.5 text-center w-10">STT</th>
                <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("employeeName")}>Nhân viên <SortIcon active={sortKey === "employeeName"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("storeName")}>Cửa hàng <SortIcon active={sortKey === "storeName"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("workDate")}>Ngày <SortIcon active={sortKey === "workDate"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-center">NV bấm</th>
                <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("checkIn")}>Giờ duyệt <SortIcon active={sortKey === "checkIn"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("workedHours")}>Số giờ <SortIcon active={sortKey === "workedHours"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-center">Duyệt</th>
                <th className="px-4 py-2.5 text-center">TT</th>
                {canOperate && <th className="px-4 py-2.5 text-center">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="py-10 text-center text-gray-400">Đang tải...</td></tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 px-4 text-center text-gray-500 text-sm">
                    {`Chưa có chấm công ngày ${formatDateVi(filterDate)}.`}
                  </td>
                </tr>
              ) : sorted.map((r, i) => (
                <tr key={r.id} className={`${i % 2 === 0 ? "bg-white" : "bg-blue-50/30"} ${r.flaggedForReview ? "ring-1 ring-inset ring-red-200" : ""}`}>
                  <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {r.employeeName} {r.flaggedForReview && <span className="text-red-500" title="Cảnh báo">⚠</span>}
                    <span className="text-xs text-gray-400 block">{r.employeeCode}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{r.storeName}</td>
                  <td className="px-4 py-2.5 text-center whitespace-nowrap">{formatDateVi(r.workDate?.slice(0, 10))}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs">
                    {r.actualCheckIn ? `${r.actualCheckIn}–${r.actualCheckOut || "…"}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono">{r.status === "Worked" ? `${r.checkIn}–${r.checkOut || "—"}` : "—"}</td>
                  <td className="px-4 py-2.5 text-center">{r.status === "Worked" && r.reviewStatus === "Confirmed" ? `${Number(r.workedHours).toFixed(1)}h` : "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Chip size="sm" color={reviewColors[r.reviewStatus] || "gray"}
                      value={r.reviewStatusLabel || r.reviewStatus || "—"} className="w-fit mx-auto normal-case" />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Chip size="sm" color={statusColors[r.status] || "gray"} value={statusLabel(r)} className="w-fit mx-auto normal-case" />
                  </td>
                  {canOperate && (
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:underline">Xóa</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          )}
        </CardBody>
      </Card>

      <AttendanceReviewModal
        open={reviewModalOpen && pendingReview.length > 0}
        records={pendingReview}
        initialIndex={reviewIndex}
        onClose={() => setReviewModalOpen(false)}
        onSaved={() => load({ silent: true })}
      />

      <AttendanceManualModal
        open={!!manualRow}
        row={manualRow}
        onClose={() => setManualRow(null)}
        onSaved={() => load({ silent: true })}
      />
    </div>
  );
}
