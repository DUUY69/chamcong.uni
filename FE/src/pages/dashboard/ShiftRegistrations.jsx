import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import ShiftCalendar from "@/components/ShiftCalendar";
import ManagerScheduleGrid from "@/components/ManagerScheduleGrid";
import ManagerDayScheduleGrid from "@/components/ManagerDayScheduleGrid";
import ManagerShiftDayPanel from "@/components/ManagerShiftDayPanel";
import { Card, CardBody, Typography, Button, Chip } from "@material-tailwind/react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/solid";
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { fetchStores, fetchStoreOptions } from "@/utils/storesApi";
import {
  MobileField, MobileTextInput, MobileSelect, MobileNotice,
} from "@/components/mobile/MobileCard";

import {
  formatShiftTime,
  formatWorkDateLabel,
  isActiveShiftStatus,
  shiftStatusColor,
  shiftStatusLabel,
  sortShiftsChronologically,
} from "@/utils/shiftFormat";
import { indexStaffingSummaries } from "@/utils/scheduleStaffing";
import { indexLaborSummaries } from "@/utils/scheduleLaborSummary";
import {
  getMondayOfWeek,
  getWeekDates,
  localTodayStr,
  REGISTRATION_SHIFT_OPTIONS,
  getRegistrationWindowHint,
  validateShiftRegistrationDate,
  extractApiError,
  formatViDate,
  defaultShiftFormForDate,
  sortStoresPrimaryFirst,
} from "@/utils/scheduleSlots";
import { useUrlFilters } from "@/utils/urlFilters";
import { mergeAdjacentShifts } from "@/utils/mergeAdjacentShifts";

const SHIFT_FILTER_DEFAULTS = {
  storeId: "",
  status: "",
  weekStart: "",
  viewMode: "week",
  dayView: "",
  year: "",
  month: "",
};

const statusLabels = { Pending: "Chờ duyệt", Approved: "Đã duyệt", Rejected: "Từ chối", Cancelled: "Đã hủy" };

const EMPTY_FORM = { storeId: "", startTime: "06:00", endTime: "14:00", customTime: false };


/** Panel đăng ký / sửa ca khi nhấn vào ngày trên lịch */
function ShiftDayPanel({ open, dateStr, dayRegs, stores, primaryStoreId, myEmployeeId, shiftTemplates = [], onClose, onSaved }) {
  const [mode, setMode] = useState("list"); // list | create | edit
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const activeRegs = useMemo(
    () => dayRegs
      .filter((r) => r.status === "Pending" || r.status === "Approved")
      .map((r) => ({ ...r, workDate: (r.workDate || dateStr || "").slice(0, 10) })),
    [dayRegs, dateStr]
  );
  const displayRegs = useMemo(() => mergeAdjacentShifts(activeRegs), [activeRegs]);
  const storeOptions = useMemo(
    () => sortStoresPrimaryFirst(stores, primaryStoreId),
    [stores, primaryStoreId]
  );

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setMode("list");
      setEditId(null);
      setFormError("");
      return;
    }
    const active = dayRegs.filter((r) => r.status === "Pending" || r.status === "Approved");
    setMode(active.length === 0 ? "create" : "list");
    setEditId(null);
    setFormError("");
    setForm(active.length === 0 ? defaultShiftFormForDate(stores, primaryStoreId) : EMPTY_FORM);
  }, [open, dateStr, dayRegs, stores, primaryStoreId]);

  const handleStoreChange = (storeId) => {
    setForm((prev) => ({ ...prev, storeId }));
    const err = validateShiftRegistrationDate(dateStr, storeId, stores);
    setFormError(err || "");
  };

  if (!open || !dateStr) return null;

  const openEdit = (r) => {
    setEditId(r.id);
    setForm({ storeId: String(r.storeId), startTime: r.startTime, endTime: r.endTime });
    setMode("edit");
  };

  const openCreate = () => {
    setEditId(null);
    setFormError("");
    setForm(defaultShiftFormForDate(stores, primaryStoreId));
    setMode("create");
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.storeId || !form.startTime || !form.endTime) {
      setFormError("Vui lòng chọn cửa hàng và giờ làm.");
      return;
    }
    const dateErr = validateShiftRegistrationDate(dateStr, form.storeId, stores);
    if (dateErr) {
      setFormError(dateErr);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        storeId: Number(form.storeId),
        startTime: form.startTime,
        endTime: form.endTime,
      };
      if (mode === "edit" && editId) {
        await api.put(`/shift-registrations/${editId}`, payload);
      } else {
        await api.post("/shift-registrations", {
          ...payload,
          workDate: dateStr,
        });
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setFormError(extractApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (block) => {
    const ids = block.registrationIds?.length ? block.registrationIds : [block.id];
    const label = `${(block.startTime || "").slice(0, 5)} – ${(block.endTime || "").slice(0, 5)}`;
    if (!confirm(ids.length > 1 ? `Hủy cả khối ca ${label} (${ids.length} khung giờ)?` : "Hủy đăng ký ca này?")) return;
    setFormError("");
    try {
      for (const id of ids) {
        await api.patch(`/shift-registrations/${id}/cancel`);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setFormError(extractApiError(e));
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Đóng" />
      <div className="relative bg-white w-full sm:max-w-md max-h-[85vh] rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b">
          <div>
            <Typography variant="h6" color="blue-gray" className="text-base">Đăng ký ca làm</Typography>
            <Typography variant="small" color="gray">{formatWorkDateLabel(dateStr)}</Typography>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-blue-gray-50">
            <XMarkIcon className="w-5 h-5 text-blue-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {formError ? (
            <MobileNotice tone="error" onDismiss={() => setFormError("")}>
              {formError}
            </MobileNotice>
          ) : null}
          {mode === "list" && (
            <>
              {displayRegs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Chưa có ca nào</p>
              ) : (
                <ul className="space-y-2">
                  {displayRegs.map((r) => {
                    const sliceCount = r.registrationIds?.length || 1;
                    const canEdit = sliceCount === 1;
                    return (
                    <li
                      key={`${r.storeId}-${r.startTime}-${r.endTime}-${r.status}`}
                      className={`rounded-lg border px-3 py-2.5 text-sm transition-shadow ${
                        canEdit ? "cursor-pointer hover:shadow-sm" : ""
                      } ${
                        r.status === "Approved"
                          ? "border-green-200 bg-green-50/60"
                          : "border-blue-200 bg-blue-50/60"
                      }`}
                      onClick={() => { if (canEdit) openEdit(r); }}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-medium">{formatShiftTime(r)}</span>
                        <Chip
                          size="sm"
                          color={shiftStatusColor(r.status)}
                          value={shiftStatusLabel(r.status)}
                          className="normal-case shrink-0"
                        />
                      </div>
                      {sliceCount > 1 && (
                        <p className="text-[11px] text-blue-gray-500 mt-0.5">
                          Gộp {sliceCount} khung giờ liền kề
                        </p>
                      )}
                      <p className="text-xs text-blue-gray-600 mt-1">{r.storeName}</p>
                      {r.storeAddress ? (
                        <p className="text-xs text-blue-gray-500 mt-0.5">{r.storeAddress}</p>
                      ) : null}
                      {r.status === "Pending" && myEmployeeId != null && Number(r.employeeId) === Number(myEmployeeId) && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleCancel(r); }}
                          className="text-xs text-red-500 mt-2 hover:underline"
                        >
                          Hủy đăng ký
                        </button>
                      )}
                    </li>
                  );})}
                </ul>
              )}
              <Button size="sm" variant="outlined" className="w-full flex items-center justify-center gap-1" onClick={openCreate}>
                <PlusIcon className="w-4 h-4" /> Thêm ca trong ngày
              </Button>
            </>
          )}

          {(mode === "create" || mode === "edit") && (
            <div className="space-y-3">
              {mode === "create" && (
                <MobileNotice tone="info">
                  Ngày <strong>{formatViDate(dateStr)}</strong> — chọn <strong>cửa hàng bạn làm trong ngày</strong> (chấm công và lương ghi nhận theo CH đã chọn; QL của CH đó duyệt ca).
                  {primaryStoreId && stores.some((s) => String(s.id) === String(primaryStoreId)) ? (
                    <> Gợi ý mặc định: <strong>{stores.find((s) => String(s.id) === String(primaryStoreId))?.name}</strong>.</>
                  ) : null}
                </MobileNotice>
              )}
              {mode === "create" && form.storeId && primaryStoreId
                && String(form.storeId) !== String(primaryStoreId) && (
                <MobileNotice tone="warning">
                  Bạn chọn CH khác cửa hàng chính — QL cửa hàng kia mới thấy và duyệt được ca này.
                </MobileNotice>
              )}
              {mode === "edit" && (
                <p className="text-xs text-blue-gray-500">
                  {activeRegs.find((r) => r.id === editId)?.status === "Approved"
                    ? "Sửa ca đã duyệt sẽ chuyển về trạng thái chờ duyệt lại."
                    : "Chỉnh sửa giờ làm và cửa hàng. Ca gộp nhiều khung — hủy rồi đăng ký lại nếu cần đổi giờ."}
                </p>
              )}
              <MobileField label="Cửa hàng (vị trí làm)" required>
                <MobileSelect
                  key={`store-${dateStr}-${mode}`}
                  value={form.storeId}
                  onChange={(e) => handleStoreChange(e.target.value)}
                >
                  <option value="">Chọn cửa hàng</option>
                  {storeOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {primaryStoreId && String(s.id) === String(primaryStoreId) ? " (CH chính)" : ""}
                    </option>
                  ))}
                </MobileSelect>
              </MobileField>
              <MobileField label="Ca làm" required>
                <div className="grid grid-cols-1 gap-2">
                  {shiftTemplates.length === 0 ? (
                    <p className="text-xs text-amber-600 py-2">Chưa có ca nào được cấu hình. Vui lòng liên hệ Admin.</p>
                  ) : shiftTemplates.map((t) => {
                    const active = form.startTime === t.startTime && form.endTime === t.endTime;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setForm({ ...form, startTime: t.startTime, endTime: t.endTime, customTime: false })}
                        style={active && t.colorHex ? { borderColor: t.colorHex, backgroundColor: t.colorHex + "15" } : {}}
                        className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                          active && !t.colorHex
                            ? "border-blue-600 bg-blue-50 text-blue-900"
                            : !active
                            ? "border-blue-gray-200 bg-white hover:bg-blue-gray-50"
                            : ""
                        }`}
                      >
                        <span className="font-medium">{t.name}</span>
                        <span className="text-blue-gray-600 ml-1">· {t.startTime} – {t.endTime}</span>
                      </button>
                    );
                  })}
                  {/* Option tự nhập giờ */}
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, customTime: !form.customTime })}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      form.customTime
                        ? "border-purple-500 bg-purple-50 text-purple-900"
                        : "border-blue-gray-200 bg-white hover:bg-blue-gray-50 text-blue-gray-600"
                    }`}
                  >
                    ✏️ <span className="font-medium">Tự nhập giờ</span>
                    <span className="text-xs ml-1 opacity-70">— ngoài khung ca cố định</span>
                  </button>
                  {form.customTime && (
                    <div className="grid grid-cols-2 gap-2 px-1">
                      <MobileField label="Giờ vào">
                        <MobileTextInput
                          type="time"
                          step={60}
                          value={form.startTime}
                          onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                        />
                      </MobileField>
                      <MobileField label="Giờ ra">
                        <MobileTextInput
                          type="time"
                          step={60}
                          value={form.endTime}
                          onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                        />
                      </MobileField>
                    </div>
                  )}
                </div>
              </MobileField>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? "Đang lưu..." : mode === "edit" ? "Lưu thay đổi" : "Đăng ký ca"}
                </Button>
                <Button size="sm" variant="outlined" onClick={() => (activeRegs.length ? setMode("list") : onClose())}>
                  {activeRegs.length ? "Quay lại" : "Hủy"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShiftRegistrations() {
  const { currentUser, isEmployee, isAdmin, isManager, isActingAsEmployee, primaryStoreId, setWorkMode } = useAuth();
  const canViewOps = (isAdmin || isManager) && !isActingAsEmployee;
  const canOperate = isManager && !isActingAsEmployee;
  const showEmployeeCalendar = isEmployee || isActingAsEmployee;
  const now = new Date();
  const { values, setFilter, setFilters } = useUrlFilters(SHIFT_FILTER_DEFAULTS);
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [regs, setRegs] = useState([]);
  const [stores, setStores] = useState([]);
  const [staffingByDate, setStaffingByDate] = useState({});
  const [laborByDate, setLaborByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const filterStatus = values.status;
  const filterStore = values.storeId;
  const calYear = values.year ? Number(values.year) : now.getFullYear();
  const calMonth = values.month ? Number(values.month) : now.getMonth() + 1;
  const gridWeekStart = values.weekStart || getMondayOfWeek(new Date());
  const gridViewMode = values.viewMode || "week";
  const dayViewDate = values.dayView || localTodayStr();
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayRegs, setSelectedDayRegs] = useState([]);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState("");

  useEffect(() => {
    api.get("/config/shift-templates?activeOnly=true")
       .then(r => setShiftTemplates(r.data.data || []))
       .catch(() => {});
  }, []);

  const monthFrom = `${calYear}-${String(calMonth).padStart(2, "0")}-01`;
  const monthTo = `${calYear}-${String(calMonth).padStart(2, "0")}-${new Date(calYear, calMonth, 0).getDate()}`;

  const loadDateRange = useMemo(() => {
    if (canViewOps && !showEmployeeCalendar) {
      const gridDates = getWeekDates(gridWeekStart);
      return { from: gridDates[0], to: gridDates[gridDates.length - 1] };
    }
    return { from: monthFrom, to: monthTo };
  }, [canViewOps, showEmployeeCalendar, monthFrom, monthTo, gridWeekStart]);

  const requiredStaff = useMemo(() => {
    if (!canViewOps || stores.length === 0) return 5;
    if (filterStore) {
      const s = stores.find((x) => String(x.id) === filterStore);
      return s?.requiredStaffPerDay || 5;
    }
    if (stores.length === 1) return stores[0]?.requiredStaffPerDay || 5;
    return Math.max(...stores.map((s) => s.requiredStaffPerDay || 5));
  }, [canViewOps, stores, filterStore]);

  const summaryTimerRef = useRef(null);

  const buildRegQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterStore) params.set("storeId", filterStore);
    if (showEmployeeCalendar) params.set("selfOnly", "true");
    params.set("dateFrom", loadDateRange.from);
    params.set("dateTo", loadDateRange.to);
    return params.toString();
  }, [filterStatus, filterStore, showEmployeeCalendar, loadDateRange]);

  const applySummaryData = useCallback((summaryRes, laborRes, storeSource) => {
    const sid = filterStore
      ? Number(filterStore)
      : (storeSource?.length === 1 ? storeSource[0]?.id : null);
    if (summaryRes?.data?.data) {
      setStaffingByDate(indexStaffingSummaries(summaryRes.data.data, { singleStoreId: sid }));
    }
    if (laborRes?.data?.data) {
      setLaborByDate(indexLaborSummaries(laborRes.data.data, { singleStoreId: sid }));
    }
  }, [filterStore]);

  const loadSummariesOnly = useCallback(async () => {
    if (!canViewOps) return;
    const summaryParams = new URLSearchParams({ dateFrom: loadDateRange.from, dateTo: loadDateRange.to });
    if (filterStore) summaryParams.set("storeId", filterStore);
    try {
      const [summaryRes, laborRes] = await Promise.all([
        api.get(`/shift-registrations/staffing-summary?${summaryParams}`),
        api.get(`/shift-registrations/day-labor-summary?${summaryParams}`),
      ]);
      applySummaryData(summaryRes, laborRes, stores);
    } catch { /* giữ số liệu cũ */ }
  }, [canViewOps, loadDateRange, filterStore, stores, applySummaryData]);

  const scheduleSummaryRefresh = useCallback(() => {
    if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
    summaryTimerRef.current = setTimeout(() => { loadSummariesOnly(); }, 900);
  }, [loadSummariesOnly]);

  /** Chỉ tải lại danh sách ca — không ẩn lưới, không F5. */
  const loadRegsOnly = useCallback(async () => {
    try {
      const qs = buildRegQuery();
      const regRes = await api.get(`/shift-registrations${qs ? `?${qs}` : ""}`);
      setRegs(regRes.data.data || []);
      scheduleSummaryRefresh();
    } catch { /* giữ lưới hiện tại */ }
  }, [buildRegQuery, scheduleSummaryRefresh]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const qs = buildRegQuery();
      const summaryParams = new URLSearchParams({ dateFrom: loadDateRange.from, dateTo: loadDateRange.to });
      if (filterStore) summaryParams.set("storeId", filterStore);

      const storeListPromise = silent
        ? Promise.resolve(null)
        : (showEmployeeCalendar
          ? fetchStoreOptions(api)
          : fetchStores(api, { isAdmin: canViewOps && isAdmin }));

      const [regRes, storeList, summaryRes, laborRes] = await Promise.all([
        api.get(`/shift-registrations${qs ? `?${qs}` : ""}`),
        storeListPromise,
        canViewOps
          ? api.get(`/shift-registrations/staffing-summary?${summaryParams}`)
          : Promise.resolve(null),
        canViewOps
          ? api.get(`/shift-registrations/day-labor-summary?${summaryParams}`)
          : Promise.resolve(null),
      ]);
      setRegs(regRes.data.data || []);
      if (!silent && storeList) setStores(storeList || []);
      const storeSource = storeList ?? stores;
      if (summaryRes?.data?.data || laborRes?.data?.data) {
        applySummaryData(summaryRes, laborRes, storeSource);
      } else if (!silent) {
        setStaffingByDate({});
        setLaborByDate({});
      }
    } catch {
      if (!silent) setRegs([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [buildRegQuery, loadDateRange, filterStore, canViewOps, isAdmin, showEmployeeCalendar, stores, applySummaryData]);

  /** Sau duyệt/từ chối/phân ca — cập nhật nền, không chớp loading. */
  const refreshRegs = useCallback(() => loadRegsOnly(), [loadRegsOnly]);

  /** Cập nhật tức thì trên lưới (panel duyệt/từ chối). */
  const patchReg = useCallback((id, patch) => {
    setRegs((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    scheduleSummaryRefresh();
  }, [scheduleSummaryRefresh]);

  const removeReg = useCallback((id) => {
    setRegs((prev) => prev.filter((r) => r.id !== id));
    scheduleSummaryRefresh();
  }, [scheduleSummaryRefresh]);

  useEffect(() => { load(); }, [filterStatus, filterStore, calYear, calMonth, gridWeekStart, showEmployeeCalendar, canViewOps]);

  useEffect(() => () => {
    if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
  }, []);

  useEffect(() => {
    setBlockedNotice("");
  }, [calYear, calMonth]);

  /** Giữ panel phân ca đồng bộ sau khi duyệt / tải lại */
  useEffect(() => {
    if (!selectedDay) return;
    setSelectedDayRegs(regs.filter((r) => r.workDate?.slice(0, 10) === selectedDay));
  }, [regs, selectedDay]);

  useEffect(() => {
    if (!canViewOps || isAdmin || !filterStore) return;
    if (!stores.some((s) => String(s.id) === filterStore)) setFilter("storeId", "");
  }, [stores, filterStore, canViewOps, isAdmin, setFilter]);

  const registrationWindowHint = getRegistrationWindowHint();

  const handleDayClick = (dateStr, dayRegs) => {
    setBlockedNotice("");
    const filtered = dayRegs ?? regs.filter((r) => r.workDate?.slice(0, 10) === dateStr);
    setSelectedDay(dateStr);
    setSelectedDayRegs(filtered);
  };

  const handleBlockedDayClick = (_dateStr, reason) => {
    setSelectedDay(null);
    setBlockedNotice(reason);
  };

  const managerStoreName = useMemo(() => {
    if (filterStore) return stores.find((s) => String(s.id) === filterStore)?.name || "";
    if (stores.length === 1) return stores[0]?.name || "";
    return "";
  }, [stores, filterStore]);

  const gridRegs = useMemo(() => {
    if (!canViewOps || showEmployeeCalendar) return regs;
    if (filterStore) return regs.filter((r) => String(r.storeId) === filterStore);
    if (stores.length === 1) return regs.filter((r) => String(r.storeId) === String(stores[0].id));
    return regs;
  }, [regs, filterStore, stores, canViewOps, showEmployeeCalendar]);

  const gridPendingCount = useMemo(
    () => gridRegs.filter((r) => r.status === "Pending").length,
    [gridRegs]
  );

  const handleAutoSchedule = async () => {
    const storeId = filterStore || (stores.length === 1 ? String(stores[0].id) : "");
    if (!storeId) {
      alert("Chọn cửa hàng trước khi tự xếp lịch.");
      return;
    }
    const weekDates = getWeekDates(gridWeekStart);
    const from = weekDates[0];
    const to = weekDates[weekDates.length - 1];
    const storeName = stores.find((s) => String(s.id) === storeId)?.name || "CH";
    if (!confirm(
      `Tự xếp lịch tuần ${from} → ${to} · ${storeName}?\n\n`
      + "1. Reset toàn bộ ca đã duyệt → chờ duyệt\n"
      + "2. Thuật toán xếp lại (≤4 NV/ca, theo giờ NV đăng ký)"
    )) return;

    setAutoScheduling(true);
    try {
      const res = await api.post("/shift-registrations/auto-schedule", {
        storeId: Number(storeId),
        dateFrom: from,
        dateTo: to,
      });
      const data = res.data?.data;
      alert(data?.message || res.data?.message || "Đã xếp lịch");
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || "Không thể tự xếp lịch");
    } finally {
      setAutoScheduling(false);
    }
  };

  return (
    <div className="mt-4">
      {isManager && !isActingAsEmployee && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Đang ở giao diện quản lý</strong> — không đăng ký ca cá nhân được ở đây.
          Bấm <strong>Nhân viên</strong> (sidebar hoặc góc phải header) rồi chọn ngày trên lịch để đăng ký ca.
          {" "}
          <button
            type="button"
            className="underline font-semibold text-amber-900"
            onClick={() => setWorkMode("employee")}
          >
            Chuyển sang Nhân viên ngay
          </button>
        </div>
      )}
      {canViewOps && !showEmployeeCalendar && (
        <ManagerShiftDayPanel
          open={!!selectedDay}
          dateStr={selectedDay}
          dayRegs={selectedDayRegs}
          stores={stores}
          requiredStaff={requiredStaff}
          readOnly={!canOperate}
          onClose={() => setSelectedDay(null)}
          onSaved={refreshRegs}
          onRegPatch={patchReg}
          onRegRemove={removeReg}
        />
      )}

      {showEmployeeCalendar && selectedDay && (
        <ShiftDayPanel
          key={selectedDay}
          open
          dateStr={selectedDay}
          dayRegs={selectedDayRegs}
          stores={stores}
          primaryStoreId={primaryStoreId}
          myEmployeeId={currentUser?.employeeId}
          shiftTemplates={shiftTemplates}
          onClose={() => setSelectedDay(null)}
          onSaved={refreshRegs}
        />
      )}

      <Card className="border border-blue-gray-100">
        <div className="p-4 border-b">
          {showEmployeeCalendar && (
            <div className="mb-3 space-y-2">
              <MobileNotice tone="info">{registrationWindowHint}</MobileNotice>
              {blockedNotice ? (
                <MobileNotice tone="warning" onDismiss={() => setBlockedNotice("")}>
                  <strong>Không đăng ký được:</strong> {blockedNotice}
                </MobileNotice>
              ) : null}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Typography variant="h6" color="blue-gray">
              {canViewOps && !showEmployeeCalendar
                ? (isAdmin ? "Theo dõi phân công ca" : "Duyệt đăng ký ca")
                : "Đăng ký ca"}
            </Typography>
            <div className="flex flex-wrap items-center gap-2">
              {showEmployeeCalendar && (
              <div className="flex items-center gap-1 text-sm text-blue-gray-600">
                  <button type="button" className="px-1 hover:text-blue-800" onClick={() => {
                    const m = calMonth === 1 ? 12 : calMonth - 1;
                    setFilters({
                      year: String(calMonth === 1 ? calYear - 1 : calYear),
                      month: String(m),
                    });
                  }}>‹</button>
                  <span className="font-medium min-w-[88px] text-center">{calMonth}/{calYear}</span>
                  <button type="button" className="px-1 hover:text-blue-800" onClick={() => {
                    const m = calMonth === 12 ? 1 : calMonth + 1;
                    setFilters({
                      year: String(calMonth === 12 ? calYear + 1 : calYear),
                      month: String(m),
                    });
                  }}>›</button>
              </div>
              )}
              {canViewOps && !showEmployeeCalendar && (
                <div className="flex rounded-lg border border-blue-gray-200 overflow-hidden text-sm">
                  <button
                    type="button"
                    className={`px-3 py-1.5 ${gridViewMode === "week" ? "bg-blue-gray-900 text-white" : "bg-white text-blue-gray-700 hover:bg-blue-gray-50"}`}
                    onClick={() => setFilter("viewMode", "week")}
                  >
                    Tuần
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 border-l border-blue-gray-200 ${gridViewMode === "day" ? "bg-blue-gray-900 text-white" : "bg-white text-blue-gray-700 hover:bg-blue-gray-50"}`}
                    onClick={() => {
                      setFilter("viewMode", "day");
                      if (!filterStore && stores.length === 1) setFilter("storeId", String(stores[0].id));
                    }}
                  >
                    Ngày
                  </button>
                </div>
              )}
              {canOperate && !showEmployeeCalendar && gridViewMode === "week" && (
                <Button
                  size="sm"
                  color="blue"
                  className="normal-case"
                  disabled={autoScheduling}
                  onClick={handleAutoSchedule}
                >
                  {autoScheduling ? "Đang xếp..." : "Tự xếp lịch tuần"}
                </Button>
              )}
              {canViewOps && (isAdmin || stores.length > 1) && (
                <select value={filterStore} onChange={(e) => setFilter("storeId", e.target.value)}
                  className="rounded-lg border border-blue-gray-200 px-2 py-1.5 text-sm bg-white">
                  <option value="">{isAdmin ? "Tất cả CH" : "Tất cả CH của tôi"}</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              <select value={filterStatus} onChange={(e) => setFilter("status", e.target.value)}
                className="rounded-lg border border-blue-gray-200 px-2 py-1.5 text-sm bg-white">
                <option value="">Tất cả TT</option>
                {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          {canViewOps && !showEmployeeCalendar && (
            <Typography variant="small" color="gray" className="mt-2 block">
              {isAdmin
                ? "Admin chỉ xem giám sát — QL cửa hàng duyệt ca và phân công. Lưới: xanh dương = chờ duyệt, xanh lá = đã duyệt."
                : <>Nhấn <strong>Tự xếp lịch tuần</strong>: reset → xếp lại (≤4 NV/ca). <strong>+ Chọn NV</strong> / ô trống: QL phân ca thay NV chưa tự đăng ký — NV thấy trên app như đã đăng ký.</>}
            </Typography>
          )}
          {canViewOps && !showEmployeeCalendar && !loading && gridRegs.length === 0 && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Không có đăng ký ca tuần này tại <strong>{managerStoreName || "cửa hàng đang lọc"}</strong>.
              Kiểm tra tuần đang xem (mũi tên ‹ ›) và bộ lọc <strong>Trạng thái</strong> (để «Tất cả TT» nếu ca mới chờ duyệt).
              {stores.length > 1 && !filterStore
                ? " Thử chọn từng cửa hàng ở bộ lọc phía trên."
                : stores.length > 1
                  ? " NV đăng ký tại CH khác (VD Betea vs Deer) sẽ không hiện — đổi bộ lọc CH."
                  : " NV chỉ được đăng ký CH được gán — nếu vẫn không thấy, kiểm tra NV đã gán đúng CH trên hệ thống chưa."}
            </div>
          )}
          {canViewOps && !showEmployeeCalendar && gridPendingCount > 0 && (
            <Typography variant="small" className="mt-1 block text-blue-600">
              {gridPendingCount} ca chờ duyệt trong tuần này{managerStoreName ? ` · ${managerStoreName}` : ""}.
            </Typography>
          )}
        </div>

        <CardBody className="p-0">
          {canViewOps && !showEmployeeCalendar ? (
            gridViewMode === "day" ? (
              <ManagerDayScheduleGrid
                registrations={gridRegs}
                workDate={dayViewDate}
                loading={loading}
                storeName={managerStoreName}
                laborByDate={laborByDate}
                storeId={filterStore || (stores.length === 1 ? String(stores[0].id) : "")}
                shiftSlots={shiftTemplates.length > 0 ? shiftTemplates.map((t) => ({
                  id: String(t.id),
                  label: t.name,
                  sub: `${t.startTime} – ${t.endTime}`,
                  start: t.startTime,
                  end: t.endTime,
                  colorHex: t.colorHex,
                })) : undefined}
                readOnly={!canOperate}
                onDateChange={(d) => setFilter("dayView", d)}
                onReassigned={refreshRegs}
              />
            ) : (
              <ManagerScheduleGrid
                registrations={gridRegs}
                staffingByDate={staffingByDate}
                laborByDate={laborByDate}
                requiredStaff={requiredStaff}
                weekStart={gridWeekStart}
                loading={loading}
                storeName={managerStoreName}
                storeId={filterStore || (stores.length === 1 ? String(stores[0].id) : "")}
                shiftSlots={shiftTemplates.length > 0 ? shiftTemplates.map((t) => ({
                  id: String(t.id),
                  label: t.name,
                  sub: `${t.startTime} – ${t.endTime}`,
                  start: t.startTime,
                  end: t.endTime,
                  colorHex: t.colorHex,
                })) : undefined}
                readOnly={!canOperate}
                onWeekChange={(d) => setFilter("weekStart", d)}
                onDayClick={(d) => {
                  setFilter("dayView", d);
                  setFilter("viewMode", "day");
                  handleDayClick(d);
                }}
                onReassigned={refreshRegs}
              />
            )
          ) : loading ? (
            <p className="py-16 text-center text-gray-400 text-sm">Đang tải lịch...</p>
          ) : (
            <ShiftCalendar
              mode="employee"
              year={calYear}
              month={calMonth}
              registrations={regs}
              staffingByDate={staffingByDate}
              requiredStaff={requiredStaff}
              onMonthChange={(y, m) => setFilters({ year: String(y), month: String(m) })}
              onDayClick={handleDayClick}
              onBlockedDayClick={handleBlockedDayClick}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
