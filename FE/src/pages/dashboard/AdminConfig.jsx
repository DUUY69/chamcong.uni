import { useState, useEffect, useMemo } from "react";
import { Card, CardBody, Typography, Button, Chip } from "@material-tailwind/react";
import { PlusIcon, PencilIcon, TrashIcon, CalendarDaysIcon, ListBulletIcon, ArrowRightIcon } from "@heroicons/react/24/solid";
import api from "@/api";
import { useSortableTable } from "@/hooks/useSortableTable";
import SortIcon from "@/components/SortIcon";
import { MobileCard, MobileListShell, MobileRow, MobileField, MobileTextInput, MobileSelect, CompactFormPanel } from "@/components/mobile/MobileCard";

const TYPE_LABELS = { Hourly: "Theo giờ", Monthly: "Theo tháng" };
const TYPE_COLORS = { Hourly: "blue", Monthly: "purple" };

const MONTH_NAMES = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];
const DOW_LABELS = ["T2","T3","T4","T5","T6","T7","CN"];

// ── Mini month calendar ────────────────────────────────────────────────────────
function MiniMonth({ year, month, holidayMap, onDayClick }) {
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDate = isThisMonth ? today.getDate() : null;

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white border border-blue-gray-100 rounded-xl p-3 shadow-sm select-none">
      <div className="text-center text-[11px] font-bold text-blue-700 mb-2 tracking-wide">{MONTH_NAMES[month - 1]}</div>
      <div className="grid grid-cols-7 text-center gap-y-0.5">
        {DOW_LABELS.map((d) => (
          <div key={d} className="text-[9px] font-semibold text-blue-gray-400 pb-1">{d}</div>
        ))}
        {cells.map((d, idx) => {
          if (!d) return <div key={`_${idx}`} />;
          const key = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const holiday = holidayMap[key];
          const isToday = d === todayDate;
          let cls = "text-[10px] leading-5 rounded-full w-5 h-5 mx-auto flex items-center justify-center font-medium cursor-pointer transition-all ";
          if (holiday && holiday.isActive) cls += "bg-red-500 text-white font-bold shadow-sm hover:bg-red-600 hover:scale-110 ";
          else if (holiday && !holiday.isActive) cls += "bg-gray-300 text-gray-500 line-through hover:bg-gray-400 ";
          else if (isToday) cls += "bg-blue-500 text-white hover:bg-blue-600 hover:scale-110 ";
          else cls += "text-blue-gray-700 hover:bg-red-100 hover:text-red-600 ";
          return (
            <div
              key={d}
              title={holiday ? `${holiday.name} ×${holiday.multiplier} — nhấn để sửa` : `Nhấn để thêm ngày lễ ${key}`}
              className={cls}
              onClick={() => onDayClick(key, holiday)}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Full year calendar ─────────────────────────────────────────────────────────
function HolidayCalendar({ year, holidays, onDayClick }) {
  const holidayMap = useMemo(() => {
    const m = {};
    holidays.forEach((h) => { m[h.date.slice(0, 10)] = h; });
    return m;
  }, [holidays]);

  const activeCount = holidays.filter((h) => h.isActive).length;

  return (
    <div className="p-4">
      <div className="flex flex-wrap gap-4 mb-4 text-xs text-gray-500 items-center">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Ngày lễ ({activeCount})</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-300 inline-block" /> Tạm dừng</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Hôm nay</span>
        <span className="text-gray-400 italic">Nhấn vào ngày bất kỳ để thêm / sửa ngày lễ</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 12 }, (_, i) => (
          <MiniMonth key={i + 1} year={year} month={i + 1} holidayMap={holidayMap} onDayClick={onDayClick} />
        ))}
      </div>
    </div>
  );
}

function formatValue(value, type) {
  const n = Number(value);
  if (isNaN(n)) return "—";
  const s = n.toLocaleString("vi-VN") + " đ";
  return type === "Hourly" ? s + "/giờ" : s + "/tháng";
}

// ── Salary Grade Form ─────────────────────────────────────────────────────────
function GradeForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial
      ? { ...initial, minTenureMonths: initial.minTenureMonths ?? 0, minWorkedHours: initial.minWorkedHours ?? 0, raiseConditionNote: initial.raiseConditionNote ?? "" }
      : { code: "", label: "", value: "", type: "Hourly", isActive: true, minTenureMonths: 0, minWorkedHours: 0, raiseConditionNote: "" }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <CompactFormPanel
      title={initial ? "Sửa bậc lương" : "Thêm bậc lương"}
      onSave={() => onSave(form)}
      onCancel={onCancel}
      columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    >
      <MobileField label="Mã bậc" required>
        <MobileTextInput value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="SL1, SM2..." />
      </MobileField>
      <MobileField label="Tên mô tả">
        <MobileTextInput value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="Nhân viên cơ bản..." />
      </MobileField>
      <MobileField label="Giá trị (đ)" required>
        <MobileTextInput type="number" value={form.value} onChange={(e) => set("value", e.target.value)} placeholder="20000" />
      </MobileField>
      <MobileField label="Loại lương" required>
        <MobileSelect value={form.type} onChange={(e) => set("type", e.target.value)}>
          <option value="Hourly">Theo giờ (đ/giờ)</option>
          <option value="Monthly">Theo tháng (đ/tháng)</option>
        </MobileSelect>
      </MobileField>
      <MobileField label="Trạng thái">
        <MobileSelect value={form.isActive ? "1" : "0"} onChange={(e) => set("isActive", e.target.value === "1")}>
          <option value="1">Đang dùng</option>
          <option value="0">Tạm dừng</option>
        </MobileSelect>
      </MobileField>
      {/* Điều kiện tăng lương */}
      <div className="col-span-1 sm:col-span-2 lg:col-span-3">
        <div className="border-t border-blue-gray-100 pt-3 mt-1">
          <p className="text-xs font-semibold text-blue-gray-700 mb-2">
            Điều kiện để Quản lý áp dụng bậc lương này
            <span className="font-normal text-blue-gray-400 ml-1">(Admin không cần điều kiện · 0 = không yêu cầu)</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MobileField label="Thâm niên tối thiểu (tháng)">
              <MobileTextInput type="number" min={0} value={form.minTenureMonths}
                onChange={(e) => set("minTenureMonths", Number(e.target.value))} placeholder="0" />
              {form.minTenureMonths > 0 && (
                <p className="text-xs text-blue-gray-400 mt-0.5">= {Math.floor(form.minTenureMonths / 12)} năm {form.minTenureMonths % 12} tháng</p>
              )}
            </MobileField>
            <MobileField label="Tổng giờ làm tối thiểu">
              <MobileTextInput type="number" min={0} value={form.minWorkedHours}
                onChange={(e) => set("minWorkedHours", Number(e.target.value))} placeholder="0 giờ" />
            </MobileField>
            <MobileField label="Ghi chú điều kiện">
              <MobileTextInput value={form.raiseConditionNote}
                onChange={(e) => set("raiseConditionNote", e.target.value)} placeholder="VD: Sau 1 năm, đạt 500h..." />
            </MobileField>
          </div>
        </div>
      </div>
    </CompactFormPanel>
  );
}

// ── Holiday Form ──────────────────────────────────────────────────────────────
function HolidayForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial ?? { date: "", name: "", multiplier: "3", isActive: true }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const dateLabel = form.date
    ? new Date(form.date + "T00:00:00").toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

  return (
    <CompactFormPanel
      title={initial?.id ? "Sửa ngày lễ" : "Thêm ngày lễ"}
      onSave={() => onSave(form)}
      onCancel={onCancel}
    >
      <MobileField label="Ngày" required>
        {form.date && !form.id ? (
          /* Date pre-filled from calendar click — show as read-only badge */
          <div className="flex items-center gap-2">
            <span className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm font-medium">
              {dateLabel}
            </span>
            <button type="button" onClick={() => set("date", "")} className="text-xs text-gray-400 hover:text-red-500 underline">đổi</button>
          </div>
        ) : (
          <MobileTextInput
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
          />
        )}
      </MobileField>
      <MobileField label="Tên ngày lễ" required>
        <MobileTextInput
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Tết Dương Lịch..."
          autoFocus
        />
      </MobileField>
      <MobileField label="Hệ số (×)" required>
        <MobileTextInput
          type="number"
          step="0.5"
          min="1"
          value={form.multiplier}
          onChange={(e) => set("multiplier", e.target.value)}
        />
      </MobileField>
      <MobileField label="Trạng thái">
        <MobileSelect value={form.isActive ? "1" : "0"} onChange={(e) => set("isActive", e.target.value === "1")}>
          <option value="1">Áp dụng</option>
          <option value="0">Tạm dừng</option>
        </MobileSelect>
      </MobileField>
    </CompactFormPanel>
  );
}

// ── Shift Template Form ───────────────────────────────────────────────────────
function ShiftTemplateForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial ?? { name: "", startTime: "06:00", endTime: "14:00", colorHex: "", sortOrder: 0, isActive: true }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <CompactFormPanel
      title={initial ? "Sửa ca làm việc" : "Thêm ca làm việc"}
      onSave={() => onSave(form)}
      onCancel={onCancel}
      columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    >
      <MobileField label="Tên ca" required>
        <MobileTextInput
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Ca sáng, Ca chiều..."
        />
      </MobileField>
      <MobileField label="Giờ bắt đầu" required>
        <MobileTextInput
          type="time"
          value={form.startTime}
          onChange={(e) => set("startTime", e.target.value)}
        />
      </MobileField>
      <MobileField label="Giờ kết thúc" required>
        <MobileTextInput
          type="time"
          value={form.endTime}
          onChange={(e) => set("endTime", e.target.value)}
        />
      </MobileField>
      <MobileField label="Màu HEX">
        <div className="flex items-center gap-2">
          <MobileTextInput
            value={form.colorHex}
            onChange={(e) => set("colorHex", e.target.value)}
            placeholder="#3B82F6"
          />
          {form.colorHex && /^#[0-9A-Fa-f]{3,6}$/.test(form.colorHex) && (
            <span
              className="inline-block w-7 h-7 rounded-md border border-blue-gray-200 shrink-0"
              style={{ backgroundColor: form.colorHex }}
            />
          )}
        </div>
      </MobileField>
      <MobileField label="Thứ tự">
        <MobileTextInput
          type="number"
          value={form.sortOrder}
          onChange={(e) => set("sortOrder", Number(e.target.value))}
          placeholder="0"
        />
      </MobileField>
      <MobileField label="Trạng thái">
        <MobileSelect value={form.isActive ? "1" : "0"} onChange={(e) => set("isActive", e.target.value === "1")}>
          <option value="1">Đang dùng</option>
          <option value="0">Tạm dừng</option>
        </MobileSelect>
      </MobileField>
    </CompactFormPanel>
  );
}

// ── Insurance Rate Form ───────────────────────────────────────────────────────
function InsuranceRateForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial ?? { code: "", label: "", amount: "", isActive: true }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <CompactFormPanel
      title={initial ? "Sửa mức trừ BH" : "Thêm mức trừ BH"}
      onSave={() => onSave(form)}
      onCancel={onCancel}
    >
      <MobileField label="Mã mức" required>
        <MobileTextInput
          value={form.code}
          onChange={(e) => set("code", e.target.value.toUpperCase())}
          placeholder="BH1, BH2..."
        />
      </MobileField>
      <MobileField label="Tên mô tả">
        <MobileTextInput
          value={form.label}
          onChange={(e) => set("label", e.target.value)}
          placeholder="Mức cơ bản..."
        />
      </MobileField>
      <MobileField label="Số tiền trừ / tháng (đ)" required>
        <MobileTextInput
          type="number"
          value={form.amount}
          onChange={(e) => set("amount", e.target.value)}
          placeholder="500000"
        />
      </MobileField>
      <MobileField label="Trạng thái">
        <MobileSelect value={form.isActive ? "1" : "0"} onChange={(e) => set("isActive", e.target.value === "1")}>
          <option value="1">Đang dùng</option>
          <option value="0">Tạm dừng</option>
        </MobileSelect>
      </MobileField>
    </CompactFormPanel>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminConfig() {
  const [tab, setTab] = useState("grades");

  // Salary Grades state
  const [grades, setGrades] = useState([]);
  const [gradesLoading, setGradesLoading] = useState(true);
  const [gradeForm, setGradeForm] = useState(null); // null=hidden, {}=new, {...}=edit
  const { sorted: sortedGrades, sortKey: gsk, sortDir: gsd, handleSort: gSort } = useSortableTable(grades);

  // Holidays state
  const [holidays, setHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [holidayForm, setHolidayForm] = useState(null);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [holidayView, setHolidayView] = useState("calendar"); // "calendar" | "list"
  const [copying, setCopying] = useState(false);
  const { sorted: sortedHolidays, sortKey: hsk, sortDir: hsd, handleSort: hSort } = useSortableTable(holidays);

  // Insurance Rates state
  const [insRates, setInsRates] = useState([]);
  const [insRatesLoading, setInsRatesLoading] = useState(true);
  const [insRateForm, setInsRateForm] = useState(null);
  const { sorted: sortedInsRates, sortKey: irsk, sortDir: irsd, handleSort: irSort } = useSortableTable(insRates);

  // Shift Templates state
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftForm, setShiftForm] = useState(null); // null=hidden, {}=new, {...}=edit
  const [shiftEditId, setShiftEditId] = useState(null);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const { sorted: sortedShifts, sortKey: ssk, sortDir: ssd, handleSort: sSort } = useSortableTable(shiftTemplates);

  // ── Loaders ──────────────────────────────────────────────────────────────────
  const loadGrades = async () => {
    setGradesLoading(true);
    try {
      const r = await api.get("/config/salary-grades");
      setGrades(r.data.data || []);
    } catch {} finally { setGradesLoading(false); }
  };

  const loadHolidays = async () => {
    setHolidaysLoading(true);
    try {
      const r = await api.get(`/config/holidays?year=${filterYear}`);
      setHolidays(r.data.data || []);
    } catch {} finally { setHolidaysLoading(false); }
  };

  const loadInsRates = async () => {
    setInsRatesLoading(true);
    try {
      const r = await api.get("/config/insurance-rates");
      setInsRates(r.data.data || []);
    } catch {} finally { setInsRatesLoading(false); }
  };

  const loadShiftTemplates = async () => {
    setShiftLoading(true);
    try {
      const r = await api.get("/config/shift-templates");
      setShiftTemplates(r.data.data || []);
    } catch {} finally { setShiftLoading(false); }
  };

  useEffect(() => { loadGrades(); }, []);
  useEffect(() => { if (tab === "holidays") loadHolidays(); }, [tab, filterYear]);
  useEffect(() => { if (tab === "insurance") loadInsRates(); }, [tab]);
  useEffect(() => { if (tab === "shifts") loadShiftTemplates(); }, [tab]);
  // ── Grade CRUD ────────────────────────────────────────────────────────────────
  const saveGrade = async (form) => {
    try {
      const payload = {
        code: form.code,
        label: form.label || null,
        value: Number(form.value),
        type: form.type,
        isActive: form.isActive,
        minTenureMonths: Number(form.minTenureMonths) || 0,
        minWorkedHours: Number(form.minWorkedHours) || 0,
        raiseConditionNote: form.raiseConditionNote?.trim() || null,
      };
      if (form.id) await api.put(`/config/salary-grades/${form.id}`, payload);
      else await api.post("/config/salary-grades", payload);
      setGradeForm(null);
      loadGrades();
    } catch (e) { alert(e?.response?.data?.message || "Lỗi lưu bậc lương"); }
  };

  const deleteGrade = async (id) => {
    if (!confirm("Xoá bậc lương này?")) return;
    try { await api.delete(`/config/salary-grades/${id}`); loadGrades(); }
    catch (e) { alert(e?.response?.data?.message || "Lỗi xoá"); }
  };

  const saveInsRate = async (form) => {
    try {
      const payload = { code: form.code, label: form.label || null, amount: Number(form.amount), isActive: form.isActive };
      if (form.id) await api.put(`/config/insurance-rates/${form.id}`, payload);
      else await api.post("/config/insurance-rates", payload);
      setInsRateForm(null);
      loadInsRates();
    } catch (e) { alert(e?.response?.data?.message || "Lỗi lưu mức trừ BH"); }
  };

  const deleteInsRate = async (id) => {
    if (!confirm("Xoá mức trừ BH này?")) return;
    try { await api.delete(`/config/insurance-rates/${id}`); loadInsRates(); }
    catch (e) { alert(e?.response?.data?.message || "Lỗi xoá"); }
  };

  // ── Shift Template CRUD ───────────────────────────────────────────────────────
  const saveShiftTemplate = async (form) => {
    try {
      const payload = {
        name: form.name,
        startTime: form.startTime,
        endTime: form.endTime,
        colorHex: form.colorHex || null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };
      if (form.id) await api.put(`/config/shift-templates/${form.id}`, payload);
      else await api.post("/config/shift-templates", payload);
      setShiftForm(null);
      loadShiftTemplates();
    } catch (e) { alert(e?.response?.data?.message || "Lỗi lưu ca làm việc"); }
  };

  const deleteShiftTemplate = async (id) => {
    if (!confirm("Xoá ca làm việc này?")) return;
    try { await api.delete(`/config/shift-templates/${id}`); loadShiftTemplates(); }
    catch (e) { alert(e?.response?.data?.message || "Lỗi xoá"); }
  };

  // ── Holiday CRUD ─────────────────────────────────────────────────────────────
  const saveHoliday = async (form) => {
    try {
      const payload = { date: form.date, name: form.name, multiplier: Number(form.multiplier), isActive: form.isActive };
      if (form.id) await api.put(`/config/holidays/${form.id}`, payload);
      else await api.post("/config/holidays", payload);
      setHolidayForm(null);
      loadHolidays();
    } catch (e) { alert(e?.response?.data?.message || "Lỗi lưu ngày lễ"); }
  };

  const deleteHoliday = async (id) => {
    if (!confirm("Xoá ngày lễ này?")) return;
    try { await api.delete(`/config/holidays/${id}`); loadHolidays(); }
    catch (e) { alert(e?.response?.data?.message || "Lỗi xoá"); }
  };

  const handleDayClick = (dateStr, existingHoliday) => {
    if (existingHoliday) {
      // Open edit form for this holiday
      setHolidayForm({ ...existingHoliday });
    } else {
      // Open new form with date pre-filled
      setHolidayForm({ date: dateStr, name: "", multiplier: "3", isActive: true });
    }
  };

  const copyToNextYear = async () => {
    const nextYear = filterYear + 1;
    if (!confirm(`Sao chép ${holidays.length} ngày lễ từ ${filterYear} → ${nextYear}?\n(Những ngày đã tồn tại sẽ được bỏ qua)`)) return;
    setCopying(true);
    let success = 0, skipped = 0;
    for (const h of holidays) {
      const orig = new Date(h.date.slice(0, 10) + "T00:00:00");
      orig.setFullYear(nextYear);
      const newDate = `${orig.getFullYear()}-${String(orig.getMonth() + 1).padStart(2,"0")}-${String(orig.getDate()).padStart(2,"0")}`;
      try {
        await api.post("/config/holidays", { date: newDate, name: h.name, multiplier: h.multiplier, isActive: h.isActive });
        success++;
      } catch { skipped++; }
    }
    setCopying(false);
    alert(`✅ Đã sao chép ${success} ngày lễ sang ${nextYear}.${skipped ? `\n⏭ Bỏ qua ${skipped} ngày đã có sẵn.` : ""}`);
    setFilterYear(nextYear);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="mt-4 space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("grades")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "grades" ? "bg-blue-600 text-white" : "bg-white border border-blue-200 text-blue-600 hover:bg-blue-50"
          }`}
        >
          Bậc lương
        </button>
        <button
          onClick={() => setTab("holidays")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "holidays" ? "bg-blue-600 text-white" : "bg-white border border-blue-200 text-blue-600 hover:bg-blue-50"
          }`}
        >
          Ngày lễ
        </button>
        <button
          onClick={() => setTab("insurance")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "insurance" ? "bg-blue-600 text-white" : "bg-white border border-blue-200 text-blue-600 hover:bg-blue-50"
          }`}
        >
          Mức trừ BH
        </button>
        <button
          onClick={() => setTab("shifts")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "shifts" ? "bg-blue-600 text-white" : "bg-white border border-blue-200 text-blue-600 hover:bg-blue-50"
          }`}
        >
          Ca làm việc
        </button>
      </div>

      {/* ── Salary Grades Tab ──────────────────────────────────────────────────── */}
      {tab === "grades" && (
        <Card className="border border-blue-gray-100">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <Typography variant="h6" color="blue-gray">Bậc lương</Typography>
              <Typography variant="small" color="gray" className="mt-0.5">
                Cấu hình mức lương gán cho nhân viên khi tạo mới
              </Typography>
            </div>
            <Button size="sm" className="flex items-center gap-1 w-full sm:w-auto justify-center"
              onClick={() => setGradeForm({})}>
              <PlusIcon className="w-4 h-4" /> Thêm bậc lương
            </Button>
          </div>
          <CardBody className="p-0">
            {gradeForm !== null && (
              <GradeForm
                initial={gradeForm.id ? gradeForm : null}
                onSave={saveGrade}
                onCancel={() => setGradeForm(null)}
              />
            )}

            {/* Mobile list */}
            <MobileListShell loading={gradesLoading} empty={!gradesLoading && grades.length === 0} emptyText="Chưa có bậc lương nào" count={grades.length}>
              {sortedGrades.map((g) => (
                <MobileCard key={g.id}>
                  <div className="flex justify-between items-center">
                    <Typography variant="small" className="font-bold text-blue-gray-900">{g.code}</Typography>
                    <Chip size="sm" color={g.isActive ? "green" : "gray"} value={g.isActive ? "Đang dùng" : "Tạm dừng"} className="normal-case" />
                  </div>
                  <MobileRow label="Tên">{g.label || "—"}</MobileRow>
                  <MobileRow label="Giá trị"><span className="font-semibold text-blue-800">{formatValue(g.value, g.type)}</span></MobileRow>
                  <MobileRow label="Loại">
                    <Chip size="sm" color={TYPE_COLORS[g.type] || "gray"} value={TYPE_LABELS[g.type] || g.type} className="normal-case" />
                  </MobileRow>
                  <div className="flex gap-3 pt-2 border-t border-blue-gray-100">
                    <button onClick={() => setGradeForm({ ...g, label: g.label ?? "", raiseConditionNote: g.raiseConditionNote ?? "", minTenureMonths: g.minTenureMonths ?? 0, minWorkedHours: g.minWorkedHours ?? 0 })} className="text-xs text-blue-600 font-medium">Sửa</button>
                    <button onClick={() => deleteGrade(g.id)} className="text-xs text-red-500 font-medium">Xoá</button>
                  </div>
                </MobileCard>
              ))}
            </MobileListShell>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-4 py-2.5 text-center w-10">STT</th>
                    <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => gSort("code")}>Mã bậc <SortIcon active={gsk === "code"} dir={gsd} /></th>
                    <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => gSort("label")}>Tên mô tả <SortIcon active={gsk === "label"} dir={gsd} /></th>
                    <th className="px-4 py-2.5 text-right cursor-pointer select-none hover:bg-blue-700" onClick={() => gSort("value")}>Giá trị lương <SortIcon active={gsk === "value"} dir={gsd} /></th>
                    <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => gSort("type")}>Loại <SortIcon active={gsk === "type"} dir={gsd} /></th>
                    <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => gSort("isActive")}>Trạng thái <SortIcon active={gsk === "isActive"} dir={gsd} /></th>
                    <th className="px-4 py-2.5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {gradesLoading ? (
                    <tr><td colSpan={7} className="py-10 text-center text-gray-400">Đang tải...</td></tr>
                  ) : grades.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-gray-400">Chưa có bậc lương nào</td></tr>
                  ) : sortedGrades.map((g, i) => (
                    <tr key={g.id} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}>
                      <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 font-bold text-blue-gray-800">{g.code}</td>
                      <td className="px-4 py-2.5 text-gray-600">{g.label || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-blue-800">{formatValue(g.value, g.type)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Chip size="sm" color={TYPE_COLORS[g.type] || "gray"} value={TYPE_LABELS[g.type] || g.type} className="w-fit mx-auto normal-case" />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Chip size="sm" color={g.isActive ? "green" : "gray"} value={g.isActive ? "Đang dùng" : "Tạm dừng"} className="w-fit mx-auto normal-case" />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => setGradeForm({ ...g, label: g.label ?? "", raiseConditionNote: g.raiseConditionNote ?? "", minTenureMonths: g.minTenureMonths ?? 0, minWorkedHours: g.minWorkedHours ?? 0 })} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                            <PencilIcon className="w-3 h-3" /> Sửa
                          </button>
                          <button onClick={() => deleteGrade(g.id)} className="text-xs text-red-500 hover:underline flex items-center gap-0.5">
                            <TrashIcon className="w-3 h-3" /> Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Holidays Tab ────────────────────────────────────────────────────────── */}
      {tab === "holidays" && (
        <Card className="border border-blue-gray-100">
          <div className="p-4 border-b flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <Typography variant="h6" color="blue-gray">Ngày lễ</Typography>
                <Typography variant="small" color="gray" className="mt-0.5">
                  Ngày lễ áp dụng hệ số lương đặc biệt (mặc định ×3 = 300%)
                </Typography>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Year picker */}
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(Number(e.target.value))}
                  className="border border-blue-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                >
                  {[2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>

                {/* Copy to next year */}
                <Button size="sm" variant="outlined" color="amber"
                  className="flex items-center gap-1 justify-center normal-case text-amber-700 border-amber-400 hover:bg-amber-50"
                  onClick={copyToNextYear} disabled={copying || holidays.length === 0}>
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                  {copying ? "Đang sao chép..." : `Sao chép → ${filterYear + 1}`}
                </Button>

                {/* View toggle */}
                <div className="flex rounded-lg border border-blue-gray-200 overflow-hidden">
                  <button
                    onClick={() => setHolidayView("calendar")}
                    className={`px-2.5 py-1.5 flex items-center gap-1 text-xs font-medium transition-colors ${holidayView === "calendar" ? "bg-blue-600 text-white" : "bg-white text-blue-gray-600 hover:bg-blue-50"}`}
                  >
                    <CalendarDaysIcon className="w-3.5 h-3.5" /> Lịch
                  </button>
                  <button
                    onClick={() => setHolidayView("list")}
                    className={`px-2.5 py-1.5 flex items-center gap-1 text-xs font-medium transition-colors ${holidayView === "list" ? "bg-blue-600 text-white" : "bg-white text-blue-gray-600 hover:bg-blue-50"}`}
                  >
                    <ListBulletIcon className="w-3.5 h-3.5" /> Danh sách
                  </button>
                </div>

                <Button size="sm" className="flex items-center gap-1 justify-center"
                  onClick={() => setHolidayForm({})}>
                  <PlusIcon className="w-4 h-4" /> Thêm ngày lễ
                </Button>
              </div>
            </div>
          </div>
          <CardBody className="p-0">
            {holidayForm !== null && (
              <HolidayForm
                key={holidayForm.date + (holidayForm.id || "new")}
                initial={holidayForm}
                onSave={saveHoliday}
                onCancel={() => setHolidayForm(null)}
              />
            )}

            {/* Calendar view */}
            {holidayView === "calendar" && !holidaysLoading && (
              <HolidayCalendar year={filterYear} holidays={holidays} onDayClick={handleDayClick} />
            )}
            {holidayView === "calendar" && holidaysLoading && (
              <div className="py-16 text-center text-gray-400 text-sm">Đang tải lịch...</div>
            )}

            {/* List view */}
            {holidayView === "list" && (<>
            {/* Mobile list */}
            <MobileListShell loading={holidaysLoading} empty={!holidaysLoading && holidays.length === 0} emptyText="Chưa có ngày lễ nào" count={holidays.length}>
              {sortedHolidays.map((h) => (
                <MobileCard key={h.id}>
                  <div className="flex justify-between items-center">
                    <Typography variant="small" className="font-semibold">{h.name}</Typography>
                    <Chip size="sm" color={h.isActive ? "green" : "gray"} value={h.isActive ? "Áp dụng" : "Tắt"} className="normal-case" />
                  </div>
                  <MobileRow label="Ngày">{new Date(h.date + "T00:00:00").toLocaleDateString("vi-VN")}</MobileRow>
                  <MobileRow label="Hệ số"><span className="font-bold text-red-600">×{h.multiplier} ({Number(h.multiplier) * 100}%)</span></MobileRow>
                  <div className="flex gap-3 pt-2 border-t border-blue-gray-100">
                    <button onClick={() => setHolidayForm({ ...h })} className="text-xs text-blue-600 font-medium">Sửa</button>
                    <button onClick={() => deleteHoliday(h.id)} className="text-xs text-red-500 font-medium">Xoá</button>
                  </div>
                </MobileCard>
              ))}
            </MobileListShell>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-4 py-2.5 text-center w-10">STT</th>
                    <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => hSort("date")}>Ngày <SortIcon active={hsk === "date"} dir={hsd} /></th>
                    <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => hSort("name")}>Tên ngày lễ <SortIcon active={hsk === "name"} dir={hsd} /></th>
                    <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => hSort("multiplier")}>Hệ số lương <SortIcon active={hsk === "multiplier"} dir={hsd} /></th>
                    <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => hSort("isActive")}>Trạng thái <SortIcon active={hsk === "isActive"} dir={hsd} /></th>
                    <th className="px-4 py-2.5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {holidaysLoading ? (
                    <tr><td colSpan={6} className="py-10 text-center text-gray-400">Đang tải...</td></tr>
                  ) : holidays.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-gray-400">Chưa có ngày lễ nào</td></tr>
                  ) : sortedHolidays.map((h, i) => (
                    <tr key={h.id} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}>
                      <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 text-center font-medium whitespace-nowrap">
                        {new Date(h.date + "T00:00:00").toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{h.name}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="font-bold text-red-600">×{h.multiplier}</span>
                        <span className="text-xs text-gray-500 ml-1">({Number(h.multiplier) * 100}%)</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Chip size="sm" color={h.isActive ? "green" : "gray"} value={h.isActive ? "Áp dụng" : "Tạm dừng"} className="w-fit mx-auto normal-case" />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => setHolidayForm({ ...h })} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                            <PencilIcon className="w-3 h-3" /> Sửa
                          </button>
                          <button onClick={() => deleteHoliday(h.id)} className="text-xs text-red-500 hover:underline flex items-center gap-0.5">
                            <TrashIcon className="w-3 h-3" /> Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>)}
          </CardBody>
        </Card>
      )}

      {/* ── Insurance Rates Tab ───────────────────────────────────────────────── */}
      {tab === "insurance" && (
        <Card className="border border-blue-gray-100">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <Typography variant="h6" color="blue-gray">Mức trừ bảo hiểm</Typography>
              <Typography variant="small" color="gray" className="mt-0.5">
                Admin cấu hình số tiền trừ lương hàng tháng — QL chọn mức khi gán BH công ty cho NV
              </Typography>
            </div>
            <Button size="sm" className="flex items-center gap-1 w-full sm:w-auto justify-center"
              onClick={() => setInsRateForm({})}>
              <PlusIcon className="w-4 h-4" /> Thêm mức trừ BH
            </Button>
          </div>
          <CardBody className="p-0">
            {insRateForm !== null && (
              <InsuranceRateForm
                initial={insRateForm.id ? insRateForm : null}
                onSave={saveInsRate}
                onCancel={() => setInsRateForm(null)}
              />
            )}

            <MobileListShell loading={insRatesLoading} empty={!insRatesLoading && insRates.length === 0} emptyText="Chưa có mức trừ BH" count={insRates.length}>
              {sortedInsRates.map((r) => (
                <MobileCard key={r.id}>
                  <div className="flex justify-between items-center">
                    <Typography variant="small" className="font-bold text-blue-gray-900">{r.code}</Typography>
                    <Chip size="sm" color={r.isActive ? "green" : "gray"} value={r.isActive ? "Đang dùng" : "Tạm dừng"} className="normal-case" />
                  </div>
                  <MobileRow label="Tên">{r.label || "—"}</MobileRow>
                  <MobileRow label="Trừ lương"><span className="font-semibold text-emerald-700">{Number(r.amount).toLocaleString("vi-VN")} đ/tháng</span></MobileRow>
                  <div className="flex gap-3 pt-2 border-t border-blue-gray-100">
                    <button onClick={() => setInsRateForm({ ...r })} className="text-xs text-blue-600 font-medium">Sửa</button>
                    <button onClick={() => deleteInsRate(r.id)} className="text-xs text-red-500 font-medium">Xoá</button>
                  </div>
                </MobileCard>
              ))}
            </MobileListShell>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-emerald-600 text-white">
                    <th className="px-4 py-2.5 text-center w-10">STT</th>
                    <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-emerald-700" onClick={() => irSort("code")}>Mã <SortIcon active={irsk === "code"} dir={irsd} /></th>
                    <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-emerald-700" onClick={() => irSort("label")}>Tên mô tả <SortIcon active={irsk === "label"} dir={irsd} /></th>
                    <th className="px-4 py-2.5 text-right cursor-pointer select-none hover:bg-emerald-700" onClick={() => irSort("amount")}>Trừ lương/tháng <SortIcon active={irsk === "amount"} dir={irsd} /></th>
                    <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-emerald-700" onClick={() => irSort("isActive")}>Trạng thái <SortIcon active={irsk === "isActive"} dir={irsd} /></th>
                    <th className="px-4 py-2.5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {insRatesLoading ? (
                    <tr><td colSpan={6} className="py-10 text-center text-gray-400">Đang tải...</td></tr>
                  ) : insRates.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-gray-400">Chưa có mức trừ BH</td></tr>
                  ) : sortedInsRates.map((r, i) => (
                    <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-emerald-50/30"}>
                      <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 font-bold text-blue-gray-800">{r.code}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.label || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{Number(r.amount).toLocaleString("vi-VN")} đ</td>
                      <td className="px-4 py-2.5 text-center">
                        <Chip size="sm" color={r.isActive ? "green" : "gray"} value={r.isActive ? "Đang dùng" : "Tạm dừng"} className="w-fit mx-auto normal-case" />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => setInsRateForm({ ...r })} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                            <PencilIcon className="w-3 h-3" /> Sửa
                          </button>
                          <button onClick={() => deleteInsRate(r.id)} className="text-xs text-red-500 hover:underline flex items-center gap-0.5">
                            <TrashIcon className="w-3 h-3" /> Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Shift Templates Tab ──────────────────────────────────────────────────── */}
      {tab === "shifts" && (
        <Card className="border border-blue-gray-100">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <Typography variant="h6" color="blue-gray">Ca làm việc</Typography>
              <Typography variant="small" color="gray" className="mt-0.5">
                Cấu hình các ca làm việc áp dụng toàn hệ thống
              </Typography>
            </div>
            <Button size="sm" className="flex items-center gap-1 w-full sm:w-auto justify-center"
              onClick={() => setShiftForm({})}>
              <PlusIcon className="w-4 h-4" /> Thêm ca làm việc
            </Button>
          </div>
          <CardBody className="p-0">
            {shiftForm !== null && (
              <ShiftTemplateForm
                initial={shiftForm.id ? shiftForm : null}
                onSave={saveShiftTemplate}
                onCancel={() => setShiftForm(null)}
              />
            )}

            {/* Mobile list */}
            <MobileListShell loading={shiftLoading} empty={!shiftLoading && shiftTemplates.length === 0} emptyText="Chưa có ca làm việc nào" count={shiftTemplates.length}>
              {sortedShifts.map((s) => (
                <MobileCard key={s.id}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {s.colorHex && /^#[0-9A-Fa-f]{3,6}$/.test(s.colorHex) && (
                        <span className="inline-block w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: s.colorHex }} />
                      )}
                      <Typography variant="small" className="font-bold text-blue-gray-900">{s.name}</Typography>
                    </div>
                    <Chip size="sm" color={s.isActive ? "green" : "gray"} value={s.isActive ? "Đang dùng" : "Tạm dừng"} className="normal-case" />
                  </div>
                  <MobileRow label="Giờ"><span className="font-semibold text-blue-800">{s.startTime} – {s.endTime}</span></MobileRow>
                  <MobileRow label="Thứ tự">{s.sortOrder}</MobileRow>
                  <div className="flex gap-3 pt-2 border-t border-blue-gray-100">
                    <button onClick={() => setShiftForm({ ...s })} className="text-xs text-blue-600 font-medium">Sửa</button>
                    <button onClick={() => deleteShiftTemplate(s.id)} className="text-xs text-red-500 font-medium">Xoá</button>
                  </div>
                </MobileCard>
              ))}
            </MobileListShell>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-4 py-2.5 text-center w-10">STT</th>
                    <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => sSort("name")}>Tên ca <SortIcon active={ssk === "name"} dir={ssd} /></th>
                    <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => sSort("startTime")}>Giờ <SortIcon active={ssk === "startTime"} dir={ssd} /></th>
                    <th className="px-4 py-2.5 text-center">Màu</th>
                    <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => sSort("sortOrder")}>Thứ tự <SortIcon active={ssk === "sortOrder"} dir={ssd} /></th>
                    <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => sSort("isActive")}>Trạng thái <SortIcon active={ssk === "isActive"} dir={ssd} /></th>
                    <th className="px-4 py-2.5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftLoading ? (
                    <tr><td colSpan={7} className="py-10 text-center text-gray-400">Đang tải...</td></tr>
                  ) : shiftTemplates.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-gray-400">Chưa có ca làm việc nào</td></tr>
                  ) : sortedShifts.map((s, i) => (
                    <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}>
                      <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 font-bold text-blue-gray-800">{s.name}</td>
                      <td className="px-4 py-2.5 text-center font-medium text-blue-800">{s.startTime} – {s.endTime}</td>
                      <td className="px-4 py-2.5 text-center">
                        {s.colorHex && /^#[0-9A-Fa-f]{3,6}$/.test(s.colorHex) ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="inline-block w-5 h-5 rounded-md border border-blue-gray-200" style={{ backgroundColor: s.colorHex }} />
                            <span className="text-xs text-gray-500 font-mono">{s.colorHex}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{s.sortOrder}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Chip size="sm" color={s.isActive ? "green" : "gray"} value={s.isActive ? "Đang dùng" : "Tạm dừng"} className="w-fit mx-auto normal-case" />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => setShiftForm({ ...s })} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                            <PencilIcon className="w-3 h-3" /> Sửa
                          </button>
                          <button onClick={() => deleteShiftTemplate(s.id)} className="text-xs text-red-500 hover:underline flex items-center gap-0.5">
                            <TrashIcon className="w-3 h-3" /> Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

    </div>
  );
}
