import { useEffect, useState, useMemo } from "react";
import { Typography, Button, Chip } from "@material-tailwind/react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { MobileField, MobileTextInput, MobileSelect } from "@/components/mobile/MobileCard";
import { formatHourlyRate, formatMoney, getHourlyRate } from "@/utils/formatMoney";
import { formatDateVi, formatTenureVi, getFirstDayOfCurrentMonthISO, getFirstDayOfNextMonthISO } from "@/utils/dates";
import { EDUCATION_LEVEL_OPTIONS, educationLevelLabel } from "@/utils/employeeHelpers";
import VietnamAddressPicker from "@/components/VietnamAddressPicker";

const STATUS_LABELS = { Draft: "Nháp", Approved: "Đã duyệt", Paid: "Đã trả" };
const STATUS_COLORS = { Draft: "gray", Approved: "blue", Paid: "green" };

function roleBadge(role) {
  if (role === "Admin") return "Admin";
  if (role === "Manager") return "Quản lý";
  return "Hệ thống";
}

export default function EmployeeDetailModal({ open, employee, canEdit, onClose, onSaved }) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "Admin";
  const [tab, setTab] = useState("info");

  // ── Info state ────────────────────────────────────────────────────────────
  const [bankForm, setBankForm] = useState({ bankAccountNo: "", bankName: "", bankAccountName: "" });
  const [bankSaving, setBankSaving] = useState(false);
  const [infoForm, setInfoForm] = useState({ educationLevel: "", address: "" });
  const [infoSaving, setInfoSaving] = useState(false);

  // ── Experience state ──────────────────────────────────────────────────────
  const [experiences, setExperiences] = useState([]);
  const [expLoading, setExpLoading] = useState(false);
  const [showExpForm, setShowExpForm] = useState(false);
  const [expEditId, setExpEditId] = useState(null);
  const [expForm, setExpForm] = useState({
    companyName: "", position: "", startDate: "", endDate: "", isCurrent: false, description: ""
  });

  // ── Salary state ──────────────────────────────────────────────────────────
  const [history, setHistory] = useState([]);
  const [payrollSummary, setPayrollSummary] = useState([]);
  const [salaryGrades, setSalaryGrades] = useState([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salarySaving, setSalarySaving] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ salaryGradeId: "", baseSalaryPerHour: "", salaryType: "Hourly", note: "" });

  const [insurance, setInsurance] = useState({
    mode: "None", insuranceRateId: "", insuranceRateCode: "", insuranceRateLabel: "",
    monthlyPremium: "", bhxhNumber: "", note: "",
  });
  const [insuranceRates, setInsuranceRates] = useState([]);
  const [insuranceExpenses, setInsuranceExpenses] = useState([]);
  const [insuranceLoading, setInsuranceLoading] = useState(false);
  const [insuranceSaving, setInsuranceSaving] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, amount: "", note: "" });

  const selectedGrade = useMemo(
    () => salaryGrades.find((g) => String(g.id) === String(salaryForm.salaryGradeId)) || null,
    [salaryGrades, salaryForm.salaryGradeId]
  );

  const selectedInsRate = useMemo(
    () => insuranceRates.find((r) => String(r.id) === String(insurance.insuranceRateId)) || null,
    [insuranceRates, insurance.insuranceRateId]
  );

  const employeeId = employee?.id;

  useEffect(() => {
    if (!open || !employee) return;
    setTab("info");
    setBankForm({
      bankAccountNo: employee.bankAccountNo || "",
      bankName: employee.bankName || "",
      bankAccountName: employee.bankAccountName || employee.fullName || "",
    });
    setInfoForm({
      educationLevel: employee.educationLevel || "",
      address: employee.address || "",
    });
    setSalaryForm({
      salaryGradeId: "",
      baseSalaryPerHour: String(getHourlyRate(employee.currentSalary) ?? ""),
      note: "",
    });
  }, [open, employee]);

  useEffect(() => {
    if (!open || !employeeId || tab !== "insurance") return;
    const load = async () => {
      setInsuranceLoading(true);
      try {
        const [insRes, expRes, ratesRes] = await Promise.all([
          api.get(`/employees/${employeeId}/insurance`),
          api.get(`/employees/${employeeId}/insurance-expenses?year=${new Date().getFullYear()}`),
          api.get("/config/insurance-rates?activeOnly=true"),
        ]);
        const ins = insRes.data.data || {};
        setInsuranceRates(ratesRes.data.data || []);
        setInsurance({
          mode: ins.mode || "None",
          insuranceRateId: ins.insuranceRateId ? String(ins.insuranceRateId) : "",
          insuranceRateCode: ins.insuranceRateCode || "",
          insuranceRateLabel: ins.insuranceRateLabel || "",
          monthlyPremium: ins.monthlyPremium ? String(ins.monthlyPremium) : "",
          bhxhNumber: ins.bhxhNumber || "",
          note: ins.note || "",
        });
        setInsuranceExpenses(expRes.data.data || []);
      } catch {
        setInsurance({ mode: "None", monthlyPremium: "", bhxhNumber: "", note: "" });
        setInsuranceExpenses([]);
      } finally { setInsuranceLoading(false); }
    };
    load();
  }, [open, employeeId, tab]);

  useEffect(() => {
    if (!open || !employeeId || (tab !== "salary" && tab !== "income")) return;
    const load = async () => {
      setSalaryLoading(true);
      try {
        const [histRes, gradeRes, payrollRes] = await Promise.all([
          api.get(`/employees/${employeeId}/salary-history`),
          canEdit ? api.get("/config/salary-grades") : api.get("/config/salary-grades?activeOnly=true"),
          api.get(`/employees/${employeeId}/payroll-summary`),
        ]);
        setHistory(histRes.data.data || []);
        setSalaryGrades(gradeRes?.data?.data?.filter((g) => g.isActive) || []);
        setPayrollSummary(payrollRes.data.data || []);
      } catch {
        setHistory([]); setSalaryGrades([]); setPayrollSummary([]);
      } finally { setSalaryLoading(false); }
    };
    load();
  }, [open, employeeId, tab, canEdit]);

  useEffect(() => {
    if (!open || !employeeId || tab !== "experience") return;
    setExpLoading(true);
    setExperiences([]);
    api.get(`/employees/${employeeId}/work-experiences`)
      .then(r => setExperiences(r.data.data || []))
      .catch(() => {})
      .finally(() => setExpLoading(false));
  }, [open, employeeId, tab]);

  if (!open || !employee) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const saveBank = async () => {
    setBankSaving(true);
    try {
      const isOwnProfile =
        currentUser?.employeeId != null && Number(employeeId) === Number(currentUser.employeeId);
      const url = isOwnProfile ? "/employees/me/bank" : `/employees/${employeeId}/bank`;
      await api.patch(url, {
        bankAccountNo: bankForm.bankAccountNo.trim() || null,
        bankName: bankForm.bankName.trim() || null,
        bankAccountName: bankForm.bankAccountName.trim() || null,
      });
      onSaved?.();
    } catch (e) { alert(e?.response?.data?.message || "Lỗi lưu ngân hàng"); }
    finally { setBankSaving(false); }
  };

  const saveInfo = async () => {
    setInfoSaving(true);
    try {
      await api.put(`/employees/${employeeId}`, {
        fullName: employee.fullName,
        phone: employee.phone,
        dateOfBirth: employee.dateOfBirth,
        gender: employee.gender,
        nationalId: employee.nationalId,
        emergencyContact: employee.emergencyContact,
        bankAccountNo: employee.bankAccountNo,
        bankName: employee.bankName,
        bankAccountName: employee.bankAccountName,
        storeIds: employee.storeIds || [],
        address: infoForm.address,
        educationLevel: infoForm.educationLevel || undefined,
      });
      onSaved?.();
    } catch (e) { alert(e?.response?.data?.message || "Lỗi lưu thông tin"); }
    finally { setInfoSaving(false); }
  };

  const handleGradeChange = (e) => {
    const gradeId = e.target.value;
    const grade = salaryGrades.find((g) => String(g.id) === gradeId);
    setSalaryForm((f) => ({
      ...f,
      salaryGradeId: gradeId,
      baseSalaryPerHour: grade ? String(grade.value) : f.baseSalaryPerHour,
      salaryType: grade ? grade.type : f.salaryType,
    }));
  };

  const saveInsurance = async () => {
    setInsuranceSaving(true);
    try {
      await api.put(`/employees/${employeeId}/insurance`, {
        mode: insurance.mode,
        insuranceRateId: insurance.mode === "CompanyProvided" ? Number(insurance.insuranceRateId || 0) : null,
        bhxhNumber: insurance.bhxhNumber,
        note: insurance.note,
      });
      alert("Đã lưu cấu hình bảo hiểm");
    } catch (e) { alert(e?.response?.data?.message || "Lỗi"); }
    finally { setInsuranceSaving(false); }
  };

  const saveExpense = async () => {
    if (!expenseForm.amount) { alert("Nhập số tiền"); return; }
    try {
      await api.post(`/employees/${employeeId}/insurance-expenses`, {
        year: Number(expenseForm.year),
        month: Number(expenseForm.month),
        amount: Number(expenseForm.amount),
        note: expenseForm.note,
      });
      const expRes = await api.get(`/employees/${employeeId}/insurance-expenses?year=${expenseForm.year}`);
      setInsuranceExpenses(expRes.data.data || []);
      setExpenseForm((f) => ({ ...f, amount: "", note: "" }));
    } catch (e) { alert(e?.response?.data?.message || "Lỗi"); }
  };

  const saveExp = async () => {
    if (!expForm.companyName.trim() || !expForm.position.trim()) {
      alert("Tên công ty và chức danh không được để trống.");
      return;
    }
    if (!expForm.isCurrent && expForm.endDate && expForm.endDate < expForm.startDate) {
      alert("Ngày kết thúc phải sau ngày bắt đầu.");
      return;
    }
    try {
      const payload = {
        companyName: expForm.companyName.trim(),
        position: expForm.position.trim(),
        startDate: expForm.startDate,
        endDate: expForm.isCurrent ? null : (expForm.endDate || null),
        description: expForm.description.trim() || null,
      };
      if (expEditId) {
        await api.put(`/employees/${employeeId}/work-experiences/${expEditId}`, payload);
      } else {
        await api.post(`/employees/${employeeId}/work-experiences`, payload);
      }
      // reload
      const r = await api.get(`/employees/${employeeId}/work-experiences`);
      setExperiences(r.data.data || []);
      setShowExpForm(false);
      setExpEditId(null);
      setExpForm({ companyName: "", position: "", startDate: "", endDate: "", isCurrent: false, description: "" });
    } catch (e) { alert(e?.response?.data?.message || "Lỗi"); }
  };

  const deleteExp = async (expId) => {
    if (!confirm("Xóa bản ghi kinh nghiệm này?")) return;
    try {
      await api.delete(`/employees/${employeeId}/work-experiences/${expId}`);
      setExperiences(prev => prev.filter(e => e.id !== expId));
    } catch (e) { alert(e?.response?.data?.message || "Lỗi"); }
  };

  const saveSalary = async () => {
    const amount = selectedGrade
      ? Number(selectedGrade.value)
      : Number(salaryForm.baseSalaryPerHour);
    if (!amount || amount <= 0) {
      alert("Vui lòng chọn bậc lương hoặc nhập mức lương lớn hơn 0.");
      return;
    }

    setSalarySaving(true);
    try {
      const res = await api.post(`/employees/${employeeId}/salary-coefficients`, {
        employeeId,
        baseSalaryPerHour: amount,
        salaryType: selectedGrade?.type || salaryForm.salaryType || "Hourly",
        coefficient: 1,
        note: salaryForm.note,
        effectiveFrom: isAdmin ? getFirstDayOfCurrentMonthISO() : getFirstDayOfNextMonthISO(),
        salaryGradeId: salaryForm.salaryGradeId && salaryForm.salaryGradeId !== "__custom__"
          ? Number(salaryForm.salaryGradeId)
          : null,
      });
      onSaved?.();
      const [histRes, payrollRes] = await Promise.all([
        api.get(`/employees/${employeeId}/salary-history`),
        api.get(`/employees/${employeeId}/payroll-summary`),
      ]);
      setHistory(histRes.data.data || []);
      setPayrollSummary(payrollRes.data.data || []);
      setSalaryForm({ salaryGradeId: "", baseSalaryPerHour: "", salaryType: "Hourly", note: "" });
      alert(res?.data?.message || "Đã lưu bậc lương.");
    } catch (e) {
      const msg = e?.response?.data?.message || "Lỗi lưu lương";
      alert(msg);
    } finally { setSalarySaving(false); }
  };

  // Totals
  const totalHours = payrollSummary.reduce((s, r) => s + Number(r.workedHours), 0);
  const totalNet = payrollSummary.reduce((s, r) => s + Number(r.netSalary), 0);

  const TABS = [
    { id: "info", label: "Thông tin" },
    { id: "insurance", label: "Bảo hiểm" },
    { id: "income", label: "Thu nhập" },
    { id: "salary", label: "Bậc lương" },
    { id: "experience", label: "Kinh nghiệm" },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-xl max-h-[92vh] rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-blue-gray-100">
          <div>
            <Typography variant="h6" color="blue-gray">Chi tiết nhân viên</Typography>
            <Typography variant="small" color="gray" className="mt-0.5">
              {employee.fullName} · {employee.employeeCode}
            </Typography>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-blue-gray-50">
            <XMarkIcon className="w-5 h-5 text-blue-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-blue-gray-100 px-4 pt-2 gap-5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-blue-gray-500 hover:text-blue-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── Tab: Thông tin ────────────────────────────────────────────── */}
          {tab === "info" && (
            <div className="space-y-4">
              {/* General info */}
              <div className="rounded-xl border border-blue-gray-100 overflow-hidden">
                <div className="bg-blue-gray-50 px-4 py-2 text-xs font-semibold text-blue-gray-600 uppercase tracking-wide">Thông tin chung</div>
                <div className="divide-y divide-blue-gray-50">
                  {[
                    ["Họ tên", employee.fullName],
                    ["Mã NV", employee.employeeCode],
                    ["Username", employee.username],
                    ["Email", employee.email],
                    ["SĐT", employee.phone || "—"],
                    ["Vai trò", employee.role === "Manager" ? "Quản lý" : employee.role === "Admin" ? "Admin" : "Nhân viên"],
                    ["Cửa hàng", employee.storeNames?.join(", ") || "—"],
                    ["Vào làm", employee.startDate ? formatDateVi(employee.startDate) : "—"],
                    ["Thâm niên", formatTenureVi(employee.startDate)],
                    ["Lương hiện tại", formatHourlyRate(employee.currentSalary)],
                    ["Trình độ", educationLevelLabel(employee.educationLevel)],
                    ["Địa chỉ", employee.address || "—"],
                    ["Trạng thái", employee.isActive ? "Đang làm" : "Đã nghỉ"],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-center px-4 py-2 gap-3">
                      <span className="text-xs text-blue-gray-500 w-28 shrink-0">{label}</span>
                      <span className="text-sm text-blue-gray-800 font-medium">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bank info */}
              <div className="rounded-xl border border-blue-gray-100 overflow-hidden">
                <div className="bg-blue-gray-50 px-4 py-2 text-xs font-semibold text-blue-gray-600 uppercase tracking-wide">Tài khoản ngân hàng</div>
                <div className="p-4 space-y-3">
                  {canEdit ? (<>
                    <MobileField label="Tên ngân hàng">
                      <MobileTextInput placeholder="VD: Vietcombank, Techcombank"
                        value={bankForm.bankName}
                        onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })} />
                    </MobileField>
                    <MobileField label="Số tài khoản">
                      <MobileTextInput placeholder="Chỉ nhập số, không dấu cách"
                        value={bankForm.bankAccountNo}
                        onChange={(e) => setBankForm({ ...bankForm, bankAccountNo: e.target.value.replace(/\s/g, "") })} />
                    </MobileField>
                    <MobileField label="Tên chủ TK">
                      <MobileTextInput placeholder="Viết hoa không dấu"
                        value={bankForm.bankAccountName}
                        onChange={(e) => setBankForm({ ...bankForm, bankAccountName: e.target.value })} />
                    </MobileField>
                    <Button size="sm" onClick={saveBank} disabled={bankSaving}>
                      {bankSaving ? "Đang lưu..." : "Lưu ngân hàng"}
                    </Button>
                  </>) : (
                    <div className="text-sm space-y-1 text-blue-gray-700">
                      <p><span className="text-blue-gray-400 mr-2">Ngân hàng:</span>{bankForm.bankName || "—"}</p>
                      <p><span className="text-blue-gray-400 mr-2">STK:</span>{bankForm.bankAccountNo || "—"}</p>
                      <p><span className="text-blue-gray-400 mr-2">Chủ TK:</span>{bankForm.bankAccountName || "—"}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Edit info */}
              {canEdit && (
                <div className="rounded-xl border border-blue-gray-100 overflow-hidden">
                  <div className="bg-blue-gray-50 px-4 py-2 text-xs font-semibold text-blue-gray-600 uppercase tracking-wide">Cập nhật thông tin cá nhân</div>
                  <div className="p-4 space-y-3">
                    <MobileField label="Trình độ">
                      <MobileSelect value={infoForm.educationLevel} onChange={(e) => setInfoForm({ ...infoForm, educationLevel: e.target.value })}>
                        <option value="">-- Chọn trình độ --</option>
                        {EDUCATION_LEVEL_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </MobileSelect>
                    </MobileField>
                    <MobileField label="Địa chỉ">
                      <VietnamAddressPicker
                        initialAddress={employee.address}
                        onChange={(addr) => setInfoForm({ ...infoForm, address: addr })}
                      />
                    </MobileField>
                    <Button size="sm" onClick={saveInfo} disabled={infoSaving}>
                      {infoSaving ? "Đang lưu..." : "Lưu thông tin"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Bảo hiểm ─────────────────────────────────────────────── */}
          {tab === "insurance" && (
            <div className="space-y-4">
              {insuranceLoading ? (
                <p className="text-sm text-gray-400 py-8 text-center">Đang tải...</p>
              ) : (
                <>
                  <div className="rounded-xl border border-blue-gray-100 overflow-hidden">
                    <div className="bg-blue-gray-50 px-4 py-2 text-xs font-semibold text-blue-gray-600 uppercase tracking-wide">
                      Hình thức bảo hiểm
                    </div>
                    <div className="p-4 space-y-3">
                      {canEdit ? (
                        <>
                          <MobileField label="Loại BH" required>
                            <MobileSelect value={insurance.mode}
                              onChange={(e) => setInsurance({ ...insurance, mode: e.target.value })}>
                              <option value="None">Không / chưa tham gia</option>
                              <option value="CompanyProvided">Công ty cung cấp (trừ lương)</option>
                              <option value="SelfPaid">NV tự mua (ghi chi phí tự trả)</option>
                            </MobileSelect>
                          </MobileField>
                          {insurance.mode === "CompanyProvided" && (
                            <>
                              <MobileField label="Mức trừ BH" required>
                                <MobileSelect value={insurance.insuranceRateId}
                                  onChange={(e) => {
                                    const rate = insuranceRates.find((r) => String(r.id) === e.target.value);
                                    setInsurance({
                                      ...insurance,
                                      insuranceRateId: e.target.value,
                                      monthlyPremium: rate ? String(rate.amount) : "",
                                    });
                                  }}>
                                  <option value="">— Chọn mức trừ BH —</option>
                                  {insuranceRates.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.code}{r.label ? ` — ${r.label}` : ""} ({Number(r.amount).toLocaleString("vi-VN")} đ/tháng)
                                    </option>
                                  ))}
                                </MobileSelect>
                              </MobileField>
                              {insuranceRates.length === 0 && (
                                <p className="text-xs text-amber-600">Admin chưa cấu hình mức trừ BH. Vào Cấu hình → Mức trừ BH.</p>
                              )}
                              {selectedInsRate && (
                                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm">
                                  Trừ lương: <span className="font-bold text-emerald-800">{Number(selectedInsRate.amount).toLocaleString("vi-VN")} đ/tháng</span>
                                </div>
                              )}
                            </>
                          )}
                          <MobileField label="Mã số BHXH">
                            <MobileTextInput value={insurance.bhxhNumber}
                              onChange={(e) => setInsurance({ ...insurance, bhxhNumber: e.target.value })} />
                          </MobileField>
                          <MobileField label="Ghi chú">
                            <MobileTextInput value={insurance.note}
                              onChange={(e) => setInsurance({ ...insurance, note: e.target.value })} />
                          </MobileField>
                          <Button size="sm" onClick={saveInsurance} disabled={insuranceSaving}>
                            {insuranceSaving ? "Đang lưu..." : "Lưu BH"}
                          </Button>
                        </>
                      ) : (
                        <div className="text-sm space-y-1 text-blue-gray-700">
                          <p><span className="text-blue-gray-400 mr-2">Loại:</span>
                            {insurance.mode === "CompanyProvided" ? "Công ty cung cấp" : insurance.mode === "SelfPaid" ? "Tự mua" : "—"}
                          </p>
                          {insurance.mode === "CompanyProvided" && (
                            <p><span className="text-blue-gray-400 mr-2">Mức trừ:</span>
                              {insurance.insuranceRateCode || "—"}
                              {insurance.insuranceRateLabel ? ` (${insurance.insuranceRateLabel})` : ""}
                              {" — "}{Number(insurance.monthlyPremium || 0).toLocaleString("vi-VN")} đ/tháng
                            </p>
                          )}
                          <p><span className="text-blue-gray-400 mr-2">Mã BHXH:</span>{insurance.bhxhNumber || "—"}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {(insurance.mode === "SelfPaid" || canEdit) && (
                    <div className="rounded-xl border border-blue-gray-100 overflow-hidden">
                      <div className="bg-blue-gray-50 px-4 py-2 text-xs font-semibold text-blue-gray-600 uppercase tracking-wide">
                        Chi phí BH tự trả (báo cáo thuế)
                      </div>
                      <div className="p-4 space-y-3">
                        {(insurance.mode === "SelfPaid" || canEdit) && (
                          <div className="grid grid-cols-2 gap-2">
                            <MobileField label="Năm">
                              <MobileTextInput type="number" value={expenseForm.year}
                                onChange={(e) => setExpenseForm({ ...expenseForm, year: e.target.value })} />
                            </MobileField>
                            <MobileField label="Tháng">
                              <MobileTextInput type="number" min={1} max={12} value={expenseForm.month}
                                onChange={(e) => setExpenseForm({ ...expenseForm, month: e.target.value })} />
                            </MobileField>
                            <MobileField label="Số tiền" required>
                              <MobileTextInput type="number" value={expenseForm.amount}
                                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                            </MobileField>
                            <MobileField label="Ghi chú">
                              <MobileTextInput value={expenseForm.note}
                                onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })} />
                            </MobileField>
                          </div>
                        )}
                        {(insurance.mode === "SelfPaid" || canEdit) && (
                          <Button size="sm" variant="outlined" onClick={saveExpense}>Lưu chi phí tháng</Button>
                        )}
                        {insuranceExpenses.length === 0 ? (
                          <p className="text-xs text-gray-400">Chưa có chi phí tự trả.</p>
                        ) : (
                          <ul className="space-y-1 text-sm">
                            {insuranceExpenses.map((x) => (
                              <li key={x.id} className="flex justify-between border-b border-blue-gray-50 py-1">
                                <span>{x.month}/{x.year}</span>
                                <span className="font-medium">{Number(x.amount).toLocaleString("vi-VN")} đ</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Tab: Thu nhập theo tháng ──────────────────────────────────── */}
          {tab === "income" && (
            <div className="space-y-4">
              {salaryLoading ? (
                <p className="text-sm text-gray-400 py-8 text-center">Đang tải...</p>
              ) : payrollSummary.length === 0 ? (
                <div className="rounded-xl border border-blue-gray-100 p-6 text-center text-sm text-gray-400">
                  Chưa có dữ liệu bảng lương. Cần tính lương ít nhất 1 kỳ.
                </div>
              ) : (<>
                {/* Tổng hợp */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">
                      {totalHours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}h
                    </div>
                    <div className="text-xs text-blue-gray-500 mt-1">Tổng giờ làm</div>
                  </div>
                  <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">{formatMoney(totalNet)}</div>
                    <div className="text-xs text-blue-gray-500 mt-1">Tổng thực nhận</div>
                  </div>
                </div>

                {/* Bảng chi tiết từng tháng */}
                <div>
                  <Typography variant="small" className="font-semibold text-blue-gray-800 mb-2">
                    Chi tiết theo tháng ({payrollSummary.length} kỳ)
                  </Typography>
                  {/* Mobile: card list */}
                  <div className="space-y-2 md:hidden">
                    {payrollSummary.map((r) => (
                      <div key={r.payrollId} className="rounded-xl border border-blue-gray-100 bg-white px-4 py-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-blue-gray-900 text-sm">T.{r.month}/{r.year}</span>
                          <Chip size="sm" color={STATUS_COLORS[r.status] || "gray"}
                            value={STATUS_LABELS[r.status] || r.status}
                            className="normal-case shrink-0" />
                        </div>
                        <div className="text-xs text-blue-gray-500 mb-2">{r.storeName}</div>
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-gray-600">
                            <span className="font-medium text-blue-700">
                              {Number(r.workedHours).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}h
                            </span>
                            {" "}giờ làm
                          </span>
                          <span className="font-bold text-green-700">
                            {Number(r.netSalary).toLocaleString("vi-VN")} đ
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop: table */}
                  <div className="hidden md:block overflow-x-auto rounded-xl border border-blue-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-blue-600 text-white">
                          <th className="px-3 py-2.5 text-center">Kỳ</th>
                          <th className="px-3 py-2.5 text-left">Cửa hàng</th>
                          <th className="px-3 py-2.5 text-center">Giờ làm</th>
                          <th className="px-3 py-2.5 text-right">Lương gộp</th>
                          <th className="px-3 py-2.5 text-right">Thực nhận</th>
                          <th className="px-3 py-2.5 text-center">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollSummary.map((r, i) => (
                          <tr key={r.payrollId} className={i % 2 === 0 ? "bg-white" : "bg-blue-gray-50/40"}>
                            <td className="px-3 py-2 text-center font-medium">T.{r.month}/{r.year}</td>
                            <td className="px-3 py-2 text-blue-gray-600 max-w-[100px] truncate">{r.storeName}</td>
                            <td className="px-3 py-2 text-center font-semibold text-blue-700">
                              {Number(r.workedHours).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}h
                            </td>
                            <td className="px-3 py-2 text-right text-blue-gray-700">
                              {Number(r.grossSalary ?? 0).toLocaleString("vi-VN")} đ
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-green-700">
                              {Number(r.netSalary).toLocaleString("vi-VN")} đ
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Chip size="sm" color={STATUS_COLORS[r.status] || "gray"}
                                value={STATUS_LABELS[r.status] || r.status}
                                className="normal-case w-fit mx-auto" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold text-sm">
                          <td className="px-3 py-2.5 text-center" colSpan={2}>Tổng cộng</td>
                          <td className="px-3 py-2.5 text-center text-blue-700">
                            {totalHours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}h
                          </td>
                          <td className="px-3 py-2.5 text-right text-blue-gray-700">—</td>
                          <td className="px-3 py-2.5 text-right text-green-700">{formatMoney(totalNet)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>)}
            </div>
          )}

          {/* ── Tab: Bậc lương ────────────────────────────────────────────── */}
          {tab === "salary" && (
            <div className="space-y-4">
              {salaryLoading ? (
                <p className="text-sm text-gray-400 py-8 text-center">Đang tải...</p>
              ) : (<>

                {/* Salary history */}
                <div>
                  <Typography variant="small" className="font-semibold text-blue-gray-800 mb-2">Lịch sử bậc lương</Typography>
                  {history.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-3">Chưa có lịch sử</p>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((row, idx) => (
                        <li key={row.id} className={`rounded-lg border px-3 py-2.5 text-sm ${idx === 0 ? "border-blue-200 bg-blue-50/60" : "border-blue-gray-100 bg-white"}`}>
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <span className="font-medium text-blue-gray-900">
                            {row.salaryType === "Monthly"
                              ? `${Number(row.baseSalaryPerHour).toLocaleString("vi-VN")} đ/tháng`
                              : formatHourlyRate(row)}
                          </span>
                          {row.salaryType === "Monthly" && (
                            <span className="text-xs text-purple-600 font-medium ml-1 bg-purple-50 px-1.5 py-0.5 rounded">Tháng</span>
                          )}
                            {idx === 0 && <Chip size="sm" value="Hiện tại" color="blue" className="normal-case shrink-0" />}
                          </div>
                          <p className="text-xs text-blue-gray-600">
                            Áp dụng từ {formatDateVi(row.effectiveFrom)}
                            {row.createdAt ? ` · Ghi nhận ${row.createdAt}` : ""}
                          </p>
                          {row.note && <p className="text-xs text-blue-gray-700 mt-1"><span className="font-medium">Lý do:</span> {row.note}</p>}
                          {canEdit && row.createdByName && (
                            <p className="text-xs text-blue-gray-500 mt-1">
                              Cập nhật bởi {row.createdByName}{row.createdByRole ? ` (${roleBadge(row.createdByRole)})` : ""}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Update salary */}
                {canEdit && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                    <Typography variant="small" className="font-semibold text-blue-gray-900">Cập nhật bậc lương</Typography>
                    <p className="text-xs text-blue-gray-600">
                      {isAdmin ? (
                        <>Áp dụng <strong>ngay từ {formatDateVi(getFirstDayOfCurrentMonthISO())}</strong> (tháng này) — chỉ Admin.</>
                      ) : (
                        <>Áp dụng từ <strong>{formatDateVi(getFirstDayOfNextMonthISO())}</strong> (ngày 1 tháng sau).</>
                      )}
                    </p>
                    <MobileField label="Bậc lương" required>
                      <MobileSelect value={salaryForm.salaryGradeId} onChange={handleGradeChange}>
                        <option value="">— Chọn bậc lương —</option>
                        {salaryGrades.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.code}{g.label ? ` · ${g.label}` : ""} — {Number(g.value).toLocaleString("vi-VN")} đ{g.type === "Hourly" ? "/giờ" : "/tháng"}
                          </option>
                        ))}
                        <option value="__custom__">✏️ Nhập tay...</option>
                      </MobileSelect>
                    </MobileField>
                    {selectedGrade && (
                      <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm">
                        <span className="font-bold text-blue-800">{selectedGrade.code}</span>
                        {selectedGrade.label && <span className="text-blue-gray-600 ml-1">— {selectedGrade.label}</span>}
                        <span className="ml-2 font-semibold text-blue-700">
                          {Number(selectedGrade.value).toLocaleString("vi-VN")} đ{selectedGrade.type === "Hourly" ? "/giờ" : "/tháng"}
                        </span>
                      </div>
                    )}
                    {/* Hiển thị điều kiện bậc lương cho Quản lý biết trước */}
                    {selectedGrade && !isAdmin && (selectedGrade.minTenureMonths > 0 || selectedGrade.minWorkedHours > 0) && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs space-y-1">
                        <p className="font-semibold text-amber-800">⚠ Điều kiện áp dụng bậc lương này:</p>
                        {selectedGrade.minTenureMonths > 0 && (
                          <p className="text-amber-700">• Thâm niên tối thiểu: <strong>{selectedGrade.minTenureMonths} tháng</strong> ({Math.floor(selectedGrade.minTenureMonths / 12)} năm {selectedGrade.minTenureMonths % 12} tháng)</p>
                        )}
                        {selectedGrade.minWorkedHours > 0 && (
                          <p className="text-amber-700">• Tổng giờ làm tối thiểu: <strong>{selectedGrade.minWorkedHours} giờ</strong></p>
                        )}
                        {selectedGrade.raiseConditionNote && (
                          <p className="text-amber-600 italic">{selectedGrade.raiseConditionNote}</p>
                        )}
                        <p className="text-amber-500 text-xs mt-1">Hệ thống sẽ kiểm tra tự động khi lưu.</p>
                      </div>
                    )}
                    {(salaryForm.salaryGradeId === "__custom__" || salaryGrades.length === 0) && (
                      <MobileField label="Lương cơ bản/giờ" required>
                        <MobileTextInput type="number" value={salaryForm.baseSalaryPerHour}
                          onChange={(e) => setSalaryForm({ ...salaryForm, baseSalaryPerHour: e.target.value })}
                          placeholder="VD: 40000" />
                      </MobileField>
                    )}
                    <MobileField label="Lý do / ghi chú">
                      <MobileTextInput value={salaryForm.note}
                        onChange={(e) => setSalaryForm({ ...salaryForm, note: e.target.value })}
                        placeholder="Lý do tăng lương..." />
                    </MobileField>
                    <Button size="sm" onClick={saveSalary}
                      disabled={salarySaving || (!salaryForm.baseSalaryPerHour && !selectedGrade)}>
                      {salarySaving ? "Đang lưu..." : "Lưu bậc lương"}
                    </Button>
                  </div>
                )}

              </>)}
            </div>
          )}

          {/* ── Tab: Kinh nghiệm ──────────────────────────────────────────── */}
          {tab === "experience" && (
            <div className="space-y-3">
              {canEdit && (
                <button type="button"
                  onClick={() => { setShowExpForm(true); setExpEditId(null); setExpForm({ companyName:"", position:"", startDate:"", endDate:"", isCurrent:false, description:"" }); }}
                  className="w-full rounded-lg border border-dashed border-blue-300 py-2 text-sm text-blue-600 hover:bg-blue-50">
                  + Thêm kinh nghiệm
                </button>
              )}
              {showExpForm && canEdit && (
                <div className="rounded-xl border border-blue-gray-200 p-4 space-y-3 bg-blue-gray-50/40">
                  <MobileField label="Tên công ty" required>
                    <MobileTextInput value={expForm.companyName} onChange={e => setExpForm({...expForm, companyName: e.target.value})} placeholder="Công ty ABC" />
                  </MobileField>
                  <MobileField label="Chức danh" required>
                    <MobileTextInput value={expForm.position} onChange={e => setExpForm({...expForm, position: e.target.value})} placeholder="Nhân viên bán hàng" />
                  </MobileField>
                  <MobileField label="Ngày bắt đầu" required>
                    <MobileTextInput type="date" value={expForm.startDate} onChange={e => setExpForm({...expForm, startDate: e.target.value})} />
                  </MobileField>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="isCurrent" checked={expForm.isCurrent}
                      onChange={e => setExpForm({...expForm, isCurrent: e.target.checked, endDate: ""})}
                      className="rounded" />
                    <label htmlFor="isCurrent" className="text-sm text-blue-gray-700">Đang làm tại đây</label>
                  </div>
                  {!expForm.isCurrent && (
                    <MobileField label="Ngày kết thúc">
                      <MobileTextInput type="date" value={expForm.endDate} onChange={e => setExpForm({...expForm, endDate: e.target.value})} />
                    </MobileField>
                  )}
                  <MobileField label="Mô tả">
                    <textarea value={expForm.description} onChange={e => setExpForm({...expForm, description: e.target.value})}
                      rows={2} placeholder="Mô tả công việc (tùy chọn)"
                      className="w-full rounded-lg border border-blue-gray-200 bg-white px-2.5 py-2 text-sm text-blue-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  </MobileField>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveExp}>{expEditId ? "Lưu thay đổi" : "Thêm"}</Button>
                    <Button size="sm" variant="outlined" onClick={() => { setShowExpForm(false); setExpEditId(null); }}>Hủy</Button>
                  </div>
                </div>
              )}
              {expLoading ? (
                <p className="text-sm text-gray-400 py-8 text-center">Đang tải...</p>
              ) : experiences.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Chưa có kinh nghiệm làm việc nào.</p>
              ) : (
                <ul className="space-y-2">
                  {experiences.map(exp => (
                    <li key={exp.id} className="rounded-xl border border-blue-gray-100 px-4 py-3 bg-white">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-semibold text-blue-gray-900 text-sm">{exp.companyName}</p>
                          <p className="text-sm text-blue-600">{exp.position}</p>
                          <p className="text-xs text-blue-gray-500 mt-0.5">
                            {exp.startDate ? new Date(exp.startDate).toLocaleDateString("vi-VN", {month:"2-digit",year:"numeric"}) : ""}
                            {" – "}
                            {exp.endDate ? new Date(exp.endDate).toLocaleDateString("vi-VN", {month:"2-digit",year:"numeric"}) : "Hiện tại"}
                          </p>
                          {exp.description && <p className="text-xs text-blue-gray-600 mt-1">{exp.description}</p>}
                        </div>
                        {canEdit && (
                          <div className="flex gap-2 shrink-0">
                            <button type="button" className="text-xs text-blue-600 hover:underline"
                              onClick={() => {
                                setExpEditId(exp.id);
                                setExpForm({
                                  companyName: exp.companyName,
                                  position: exp.position,
                                  startDate: exp.startDate || "",
                                  endDate: exp.endDate || "",
                                  isCurrent: !exp.endDate,
                                  description: exp.description || "",
                                });
                                setShowExpForm(true);
                              }}>Sửa</button>
                            <button type="button" className="text-xs text-red-500 hover:underline"
                              onClick={() => deleteExp(exp.id)}>Xóa</button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-blue-gray-100 flex justify-end">
          <Button variant="outlined" size="sm" onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </div>
  );
}
