import { useState, useEffect, useMemo } from "react";
import { useSortableTable } from "@/hooks/useSortableTable";
import SortIcon from "@/components/SortIcon";
import { Card, CardBody, Typography, Button, Chip } from "@material-tailwind/react";
import { PlusIcon } from "@heroicons/react/24/solid";
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { useUrlFilters } from "@/utils/urlFilters";
import {
  MobileCard, MobileListShell, MobileRow, MobileField, MobileTextInput, MobileSelect,
  CompactFormPanel,
} from "@/components/mobile/MobileCard";
import EmployeeDetailModal from "@/components/EmployeeDetailModal";
import { formatBankLine } from "@/components/BankInfoModal";
import { formatHourlyRate } from "@/utils/formatMoney";
import { formatDateVi, formatTenureVi } from "@/utils/dates";
import { EDUCATION_LEVEL_OPTIONS, educationLevelLabel } from "@/utils/employeeHelpers";
import VietnamAddressPicker from "@/components/VietnamAddressPicker";

const EMPLOYEE_FILTER_DEFAULTS = { q: "", storeId: "", role: "", status: "" };

function roleLabel(role) {
  if (role === "Manager") return "Quản lý";
  if (role === "Admin") return "Admin";
  return "Nhân viên";
}

export default function Employees() {
  const { isAdmin, isManager } = useAuth();
  const canManageSalary = isAdmin || isManager;
  const canCreateEmployee = isAdmin || isManager;
  const [employees, setEmployees] = useState([]);
  const [stores, setStores] = useState([]);
  const [salaryGrades, setSalaryGrades] = useState([]);
  const [insuranceRates, setInsuranceRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detailEmp, setDetailEmp] = useState(null);

  const { values, setFilter, setFilters, clearFilters } = useUrlFilters(EMPLOYEE_FILTER_DEFAULTS);
  const search = values.q;
  const filterStoreId = values.storeId;
  const filterRole = values.role;
  const filterStatus = values.status || (isAdmin ? "" : "active");
  const [availHint, setAvailHint] = useState(null);
  const [listStats, setListStats] = useState(null);

  const [form, setForm] = useState({
    fullName: "", email: "", username: "", password: "", role: "Employee",
    phone: "", startDate: "", primaryStoreId: "", baseSalaryPerHour: "", coefficient: "1.0",
    bankAccountNo: "", bankName: "", bankAccountName: "",
    salaryGradeId: "",
    educationLevel: "",
    address: "",
    insuranceMode: "None",
    insuranceRateId: "",
    bhxhNumber: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const empQs = isAdmin ? "" : "?isActive=true";
      const [empRes, storeRes, gradeRes, insRatesRes, statsRes] = await Promise.all([
        api.get(`/employees${empQs}`),
        api.get("/stores"),
        api.get("/config/salary-grades?activeOnly=true"),
        api.get("/config/insurance-rates?activeOnly=true"),
        api.get("/employees/list-stats").catch(() => ({ data: { data: null } })),
      ]);
      const list = empRes.data.data || [];
      setEmployees(list);
      setDetailEmp((prev) => (prev ? list.find((e) => e.id === prev.id) || prev : null));
      setListStats(statsRes.data.data || null);
      setStores(storeRes.data.data || []);
      setSalaryGrades(gradeRes.data.data || []);
      setInsuranceRates(insRatesRes.data.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const employeesFlat = useMemo(() =>
    employees.map((emp) => ({
      ...emp,
      tenureDays: emp.startDate
        ? Math.floor((Date.now() - new Date(emp.startDate)) / 86400000)
        : -1,
      salaryPerHour: emp.currentSalary?.baseSalaryPerHour ?? 0,
      heSo: emp.currentSalary?.coefficient ?? 0,
      storeNamesStr: emp.storeNames?.join(", ") ?? "",
    })),
    [employees]
  );

  const { sorted, sortKey, sortDir, handleSort } = useSortableTable(employeesFlat);

  // ── Filtered result ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = sorted;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((e) =>
        e.fullName?.toLowerCase().includes(q) ||
        e.employeeCode?.toLowerCase().includes(q) ||
        e.username?.toLowerCase().includes(q) ||
        e.phone?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q)
      );
    }
    if (filterStoreId) {
      list = list.filter((e) => e.storeIds?.includes(Number(filterStoreId)));
    }
    if (filterRole) {
      list = list.filter((e) => e.role === filterRole);
    }
    if (filterStatus === "active") list = list.filter((e) => e.isActive);
    if (filterStatus === "inactive") list = list.filter((e) => !e.isActive);
    return list;
  }, [sorted, search, filterStoreId, filterRole, filterStatus]);

  const checkAvailability = async (username, email) => {
    if (!username?.trim() && !email?.trim()) { setAvailHint(null); return; }
    try {
      const res = await api.get("/employees/check-availability", {
        params: { username: username?.trim() || undefined, email: email?.trim() || undefined },
      });
      const d = res.data.data || {};
      const parts = [];
      if (d.usernameConflict) {
        const c = d.usernameConflict;
        parts.push(`Username: ${c.isOrphan ? "user mồ côi" : c.employeeCode || c.username} (UserId ${c.userId}) — không hiện trong danh sách NV nếu là user mồ côi hoặc NV CH khác.`);
      }
      if (d.emailConflict) {
        const c = d.emailConflict;
        parts.push(`Email: ${c.isOrphan ? "user mồ côi" : c.employeeCode || c.email} (UserId ${c.userId}).`);
      }
      setAvailHint(parts.length ? parts.join(" ") : null);
    } catch {
      setAvailHint(null);
    }
  };

  const suggestUsername = () => {
    const phone = (form.phone || "").replace(/\D/g, "");
    if (phone.length >= 6) return phone.slice(-10);
    const parts = (form.fullName || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    const last = parts[parts.length - 1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const first = parts[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return `${first}.${last}`.replace(/[^a-z0-9._-]/g, "");
  };

  const handleCreate = async () => {
    try {
      if (!form.primaryStoreId) { alert("Chọn cửa hàng chính"); return; }
      const createRes = await api.post("/employees", {
        ...form,
        role: isManager && !isAdmin ? "Employee" : form.role,
        primaryStoreId: Number(form.primaryStoreId),
        storeIds: [Number(form.primaryStoreId)],
        baseSalaryPerHour: form.baseSalaryPerHour ? Number(form.baseSalaryPerHour) : undefined,
        coefficient: Number(form.coefficient),
        salaryGradeId: form.salaryGradeId ? Number(form.salaryGradeId) : undefined,
        educationLevel: form.educationLevel || undefined,
      });
      
      // Nếu có thông tin bảo hiểm, gọi PUT /employees/:id/insurance
      const newEmpId = createRes.data.data?.id;
      if (newEmpId && form.insuranceMode !== "None") {
        await api.put(`/employees/${newEmpId}/insurance`, {
          mode: form.insuranceMode,
          insuranceRateId: form.insuranceMode === "CompanyProvided" ? Number(form.insuranceRateId || 0) : null,
          bhxhNumber: form.bhxhNumber || null,
          note: null,
        });
      }
      
      setShowForm(false);
      load();
    } catch (e) {
      const msg = e?.response?.data?.message || "Lỗi tạo nhân viên";
      alert(msg);
    }
  };

  const toggleActive = async (emp) => {
    try { await api.patch(`/employees/${emp.id}/toggle-active`); load(); }
    catch (e) { alert(e?.response?.data?.message || "Lỗi"); }
  };

  return (
    <div className="mt-4">
      <EmployeeDetailModal
        open={!!detailEmp}
        employee={detailEmp}
        canEdit={canManageSalary}
        onClose={() => setDetailEmp(null)}
        onSaved={load}
      />

      <Card className="border border-blue-gray-100">
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <Typography variant="h6" color="blue-gray">Quản lý Nhân viên</Typography>
          {canCreateEmployee && (
            <Button size="sm" className="flex items-center gap-1 w-full sm:w-auto justify-center" onClick={() => setShowForm(!showForm)}>
              <PlusIcon className="w-4 h-4" /> Thêm nhân viên
            </Button>
          )}
        </div>

        {/* ── Search / Filter bar ─────────────────────────────────────── */}
        <div className="px-4 py-3 border-b bg-blue-gray-50/40 flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setFilter("q", e.target.value)}
            placeholder="🔍 Tìm tên, mã NV, username, SĐT, email..."
            className="flex-1 min-w-[180px] rounded-lg border border-blue-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <select value={filterStoreId} onChange={(e) => setFilter("storeId", e.target.value)}
            className="rounded-lg border border-blue-gray-200 bg-white px-2 py-1.5 text-sm">
            <option value="">Tất cả cửa hàng</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterRole} onChange={(e) => setFilter("role", e.target.value)}
            className="rounded-lg border border-blue-gray-200 bg-white px-2 py-1.5 text-sm">
            <option value="">Tất cả vai trò</option>
            <option value="Employee">Nhân viên</option>
            <option value="Manager">Quản lý</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilter("status", e.target.value)}
            className="rounded-lg border border-blue-gray-200 bg-white px-2 py-1.5 text-sm">
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang làm</option>
            <option value="inactive">Đã nghỉ</option>
          </select>
          {(search || filterStoreId || filterRole || values.status) && (
            <button type="button"
              onClick={() => clearFilters()}
              className="text-xs text-red-500 hover:underline whitespace-nowrap">
              ✕ Xóa lọc
            </button>
          )}
          <span className="text-xs text-blue-gray-400 whitespace-nowrap">
            {filtered.length}/{employees.length} NV
            {listStats?.employeesInDatabase > employees.length && (
              <span className="text-amber-700" title={listStats.note}>
                {" "}(DB: {listStats.employeesInDatabase})
              </span>
            )}
          </span>
        </div>
        {listStats?.employeesInDatabase > employees.length && (
          <p className="px-4 pb-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-100">
            Hiển thị <strong>{listStats.employeesVisibleToYou}</strong> NV cửa hàng bạn quản lý / <strong>{listStats.employeesInDatabase}</strong> hồ sơ trong DB.
            Bảng <strong>Users</strong> ({listStats.usersInDatabase} tài khoản) còn có QL (<code>PASSION.*</code>, <code>admin</code>) — không phải dòng trong danh sách NV.
            {listStats.orphanUsers > 0 && <> Có <strong>{listStats.orphanUsers}</strong> user mồ côi (gây báo trùng username).</>}
          </p>
        )}
        <CardBody className="p-0">
          {showForm && canCreateEmployee && (
            <CompactFormPanel title="Thêm nhân viên mới" onSave={handleCreate} onCancel={() => setShowForm(false)}>
              <MobileField label="Họ tên" required>
                <MobileTextInput value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </MobileField>
              <MobileField label="Username" required>
                <div className="flex gap-2">
                  <MobileTextInput
                    className="flex-1"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value.trim() })}
                    onBlur={() => checkAvailability(form.username, form.email)}
                    placeholder="vd: 0948864050 hoặc duy.tran"
                  />
                  <button
                    type="button"
                    className="shrink-0 text-xs px-2 py-1 rounded border border-blue-gray-200 text-blue-600 hover:bg-blue-50"
                    onClick={() => {
                      const s = suggestUsername();
                      if (s) setForm((f) => ({ ...f, username: s }));
                    }}
                  >
                    Gợi ý
                  </button>
                </div>
                <p className="text-xs text-blue-gray-500 mt-1">Username lưu trong bảng Users (toàn hệ thống), không chỉ danh sách NV bạn đang thấy.</p>
              </MobileField>
              <MobileField label="Email" required>
                <MobileTextInput value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} onBlur={() => checkAvailability(form.username, form.email)} />
              </MobileField>
              {availHint && (
                <p className="col-span-2 sm:col-span-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  {availHint}
                </p>
              )}
              <MobileField label="Mật khẩu" required>
                <MobileTextInput type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </MobileField>
              <MobileField label="SĐT">
                <MobileTextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </MobileField>
              <MobileField label="Trình độ">
                <MobileSelect value={form.educationLevel} onChange={(e) => setForm({ ...form, educationLevel: e.target.value })}>
                  <option value="">-- Chọn trình độ --</option>
                  {EDUCATION_LEVEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </MobileSelect>
              </MobileField>
              <MobileField label="Địa chỉ" className="col-span-2 sm:col-span-3">
                <VietnamAddressPicker onChange={(addr) => setForm({ ...form, address: addr })} />
              </MobileField>
              <MobileField label="Tên ngân hàng">
                <MobileTextInput value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
              </MobileField>
              <MobileField label="Số TK">
                <MobileTextInput value={form.bankAccountNo} onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })} />
              </MobileField>
              <MobileField label="Tên chủ TK">
                <MobileTextInput value={form.bankAccountName} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} placeholder={form.fullName || "Họ tên không dấu"} />
              </MobileField>
              <MobileField label="Ngày vào làm" required>
                <MobileTextInput type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </MobileField>
              <MobileField label="Bậc lương" className="col-span-2 sm:col-span-3">
                <MobileSelect
                  value={form.salaryGradeId}
                  onChange={(e) => {
                    const gid = e.target.value;
                    const grade = salaryGrades.find((g) => String(g.id) === gid);
                    setForm({
                      ...form,
                      salaryGradeId: gid,
                      baseSalaryPerHour: grade ? String(grade.value) : form.baseSalaryPerHour,
                    });
                  }}
                >
                  <option value="">-- Chọn bậc lương hoặc nhập thủ công --</option>
                  {salaryGrades.filter((g) => g.type === "Hourly").length > 0 && (
                    <optgroup label="Theo giờ">
                      {salaryGrades.filter((g) => g.type === "Hourly").map((g) => (
                        <option key={g.id} value={g.id}>{g.code} — {Number(g.value).toLocaleString("vi-VN")} đ/giờ{g.label ? ` (${g.label})` : ""}</option>
                      ))}
                    </optgroup>
                  )}
                  {salaryGrades.filter((g) => g.type === "Monthly").length > 0 && (
                    <optgroup label="Theo tháng">
                      {salaryGrades.filter((g) => g.type === "Monthly").map((g) => (
                        <option key={g.id} value={g.id}>{g.code} — {Number(g.value).toLocaleString("vi-VN")} đ/tháng{g.label ? ` (${g.label})` : ""}</option>
                      ))}
                    </optgroup>
                  )}
                </MobileSelect>
              </MobileField>
              <MobileField label="Lương/giờ (thủ công)">
                <MobileTextInput
                  type="number"
                  value={form.baseSalaryPerHour}
                  onChange={(e) => setForm({ ...form, baseSalaryPerHour: e.target.value, salaryGradeId: "" })}
                  placeholder={form.salaryGradeId ? "Tự động từ bậc lương" : "Nhập thủ công..."}
                />
              </MobileField>
              <MobileField label="Vai trò">
                {isAdmin ? (
                  <MobileSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="Employee">Nhân viên</option>
                    <option value="Manager">Quản lý</option>
                  </MobileSelect>
                ) : (
                  <MobileTextInput value="Nhân viên" readOnly disabled className="bg-blue-gray-50" />
                )}
              </MobileField>
              <MobileField label="Cửa hàng chính" required className="col-span-2 sm:col-span-3">
                <MobileSelect
                  value={form.primaryStoreId}
                  onChange={(e) => setForm({ ...form, primaryStoreId: e.target.value })}
                >
                  <option value="">— Chọn cửa hàng chính —</option>
                  {stores.filter((s) => s.isActive).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </MobileSelect>
                <p className="text-xs text-blue-gray-500 mt-1">
                  Mỗi người chỉ một cửa hàng chính. Quản lý vẫn có thể đăng ký ca tại cửa hàng khác khi đăng ký ca làm.
                </p>
              </MobileField>
              
              {/* Bảo hiểm */}
              <MobileField label="Loại bảo hiểm" className="col-span-2">
                <MobileSelect value={form.insuranceMode} onChange={(e) => setForm({ ...form, insuranceMode: e.target.value })}>
                  <option value="None">Không / chưa tham gia</option>
                  <option value="CompanyProvided">Công ty cung cấp (trừ lương)</option>
                  <option value="SelfPaid">NV tự mua</option>
                </MobileSelect>
              </MobileField>
              {form.insuranceMode === "CompanyProvided" && (
                <MobileField label="Mức trừ BH" className="col-span-2">
                  <MobileSelect value={form.insuranceRateId} onChange={(e) => setForm({ ...form, insuranceRateId: e.target.value })}>
                    <option value="">— Chọn mức trừ BH —</option>
                    {insuranceRates.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code}{r.label ? ` — ${r.label}` : ""} ({Number(r.amount).toLocaleString("vi-VN")} đ/tháng)
                      </option>
                    ))}
                  </MobileSelect>
                </MobileField>
              )}
              <MobileField label="Mã số BHXH">
                <MobileTextInput value={form.bhxhNumber} onChange={(e) => setForm({ ...form, bhxhNumber: e.target.value })} placeholder="Mã BHXH (nếu có)" />
              </MobileField>
            </CompactFormPanel>
          )}

          <MobileListShell loading={loading} empty={!loading && filtered.length === 0} emptyText="Không tìm thấy nhân viên" count={filtered.length}>
            {filtered.map((emp) => (
              <MobileCard key={emp.id}>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <Typography variant="small" className="font-semibold text-blue-gray-900">{emp.fullName}</Typography>
                    <Typography variant="small" color="gray" className="font-mono text-xs mt-0.5">{emp.employeeCode}</Typography>
                  </div>
                  <Chip size="sm" color={emp.isActive ? "green" : "gray"} value={emp.isActive ? "Đang làm" : "Nghỉ"} className="shrink-0 normal-case" />
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 space-y-1.5">
                  <MobileRow label="Vào làm">{emp.startDate ? formatDateVi(emp.startDate) : "—"}</MobileRow>
                  <MobileRow label="Thâm niên"><span className="text-blue-800">{formatTenureVi(emp.startDate)}</span></MobileRow>
                </div>
                <MobileRow label="Vai trò">
                  <Chip size="sm" color={emp.role === "Manager" ? "blue" : "gray"} value={roleLabel(emp.role)} className="normal-case" />
                </MobileRow>
                <MobileRow label="SĐT">{emp.phone || "—"}</MobileRow>
                <MobileRow label="Cửa hàng"><span className="text-xs font-normal text-right">{emp.storeNames?.join(", ") || "—"}</span></MobileRow>
                <MobileRow label="Lương/giờ">{formatHourlyRate(emp.currentSalary)}</MobileRow>
                <MobileRow label="Ngân hàng"><span className="text-xs text-right">{formatBankLine(emp)}</span></MobileRow>
                <div className="flex gap-3 pt-2 border-t border-blue-gray-100">
                  <button type="button" onClick={() => setDetailEmp(emp)}
                    className="text-xs text-blue-600 font-medium">Chi tiết</button>
                  {isAdmin && (
                    <button type="button" onClick={() => toggleActive(emp)}
                      className={`text-xs font-medium ${emp.isActive ? "text-red-500" : "text-green-600"}`}>
                      {emp.isActive ? "Vô hiệu" : "Kích hoạt"}
                    </button>
                  )}
                </div>
              </MobileCard>
            ))}
          </MobileListShell>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="px-4 py-2.5 text-center w-10">STT</th>
                  <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("employeeCode")}>Mã NV <SortIcon active={sortKey === "employeeCode"} dir={sortDir} /></th>
                  <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("fullName")}>Họ tên <SortIcon active={sortKey === "fullName"} dir={sortDir} /></th>
                  <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("startDate")}>Vào làm <SortIcon active={sortKey === "startDate"} dir={sortDir} /></th>
                  <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("tenureDays")}>Thâm niên <SortIcon active={sortKey === "tenureDays"} dir={sortDir} /></th>
                  <th className="px-4 py-2.5 text-left">SĐT</th>
                  <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("educationLevel")}>Trình độ <SortIcon active={sortKey === "educationLevel"} dir={sortDir} /></th>
                  <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("role")}>Vai trò <SortIcon active={sortKey === "role"} dir={sortDir} /></th>
                  <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("storeNamesStr")}>Cửa hàng <SortIcon active={sortKey === "storeNamesStr"} dir={sortDir} /></th>
                  <th className="px-4 py-2.5 text-right cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("salaryPerHour")}>Lương/giờ <SortIcon active={sortKey === "salaryPerHour"} dir={sortDir} /></th>
                  <th className="px-4 py-2.5 text-left">Ngân hàng / STK</th>
                  <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("isActive")}>Trạng thái <SortIcon active={sortKey === "isActive"} dir={sortDir} /></th>
                  <th className="px-4 py-2.5 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={13} className="py-10 text-center text-gray-400">Đang tải...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={13} className="py-10 text-center text-gray-400">Không tìm thấy nhân viên</td></tr>
                ) : filtered.map((emp, i) => (
                  <tr key={emp.id} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}>
                    <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{emp.employeeCode}</td>
                    <td className="px-4 py-2.5 font-medium">{emp.fullName}</td>
                    <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{emp.startDate ? formatDateVi(emp.startDate) : "—"}</td>
                    <td className="px-4 py-2.5 text-blue-800 font-medium whitespace-nowrap">{formatTenureVi(emp.startDate)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{emp.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-700 text-xs">{educationLevelLabel(emp.educationLevel)}</td>
                    <td className="px-4 py-2.5">
                      <Chip size="sm" color={emp.role === "Admin" ? "red" : emp.role === "Manager" ? "blue" : "gray"}
                        value={roleLabel(emp.role)} className="w-fit" />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{emp.storeNames?.join(", ") || "—"}</td>
                    <td className="px-4 py-2.5 text-right">{formatHourlyRate(emp.currentSalary)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[200px]">{formatBankLine(emp)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Chip size="sm" color={emp.isActive ? "green" : "gray"} value={emp.isActive ? "Đang làm" : "Nghỉ"} className="w-fit mx-auto" />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button type="button" onClick={() => setDetailEmp(emp)}
                          className="text-xs text-blue-600 hover:underline font-medium">Chi tiết</button>
                        {isAdmin && (
                          <button type="button" onClick={() => toggleActive(emp)}
                            className={`text-xs font-medium hover:underline ${emp.isActive ? "text-red-500" : "text-green-600"}`}>
                            {emp.isActive ? "Vô hiệu" : "Kích hoạt"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
