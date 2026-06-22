import { useEffect, useState } from "react";
import { Typography, Button } from "@material-tailwind/react";
import { useAuth } from "@/context/AuthContext";
import api from "@/api";
import { MobileField, MobileTextInput, MobileSelect } from "@/components/mobile/MobileCard";
import { formatHourlyRate, formatMoney } from "@/utils/formatMoney";
import { formatDateVi, formatTenureVi } from "@/utils/dates";

export default function Profile() {
  const { currentUser, refreshUser } = useAuth();
  const [tab, setTab] = useState("info");

  // ── Bank ─────────────────────────────────────────────────────────────────
  const [bankForm, setBankForm] = useState({ bankAccountNo: "", bankName: "", bankAccountName: "" });
  const [bankSaving, setBankSaving] = useState(false);

  // ── Salary / Income ──────────────────────────────────────────────────────
  const [history, setHistory] = useState([]);
  const [payrollSummary, setPayrollSummary] = useState([]);
  const [salaryLoading, setSalaryLoading] = useState(false);

  // ── Insurance ────────────────────────────────────────────────────────────
  const [insurance, setInsurance] = useState({ mode: "None", bhxhNumber: "", note: "", insuranceRateCode: "", insuranceRateLabel: "", monthlyPremium: "" });
  const [insuranceExpenses, setInsuranceExpenses] = useState([]);
  const [insuranceLoading, setInsuranceLoading] = useState(false);

  const employeeId = currentUser?.employeeId;

  // Init bank form từ currentUser
  useEffect(() => {
    if (!currentUser) return;
    setBankForm({
      bankAccountNo: currentUser.bankAccountNo || "",
      bankName: currentUser.bankName || "",
      bankAccountName: currentUser.bankAccountName || currentUser.fullName || "",
    });
  }, [currentUser]);

  // Load insurance tab
  useEffect(() => {
    if (!employeeId || tab !== "insurance") return;
    setInsuranceLoading(true);
    (async () => {
      try {
        const [insRes, expRes] = await Promise.all([
          api.get(`/employees/${employeeId}/insurance`),
          api.get(`/employees/${employeeId}/insurance-expenses?year=${new Date().getFullYear()}`),
        ]);
        const ins = insRes.data.data || {};
        setInsurance({
          mode: ins.mode || "None",
          bhxhNumber: ins.bhxhNumber || "",
          note: ins.note || "",
          insuranceRateCode: ins.insuranceRateCode || "",
          insuranceRateLabel: ins.insuranceRateLabel || "",
          monthlyPremium: ins.monthlyPremium ? String(ins.monthlyPremium) : "",
        });
        setInsuranceExpenses(expRes.data.data || []);
      } catch {
        setInsurance({ mode: "None", bhxhNumber: "", note: "", insuranceRateCode: "", insuranceRateLabel: "", monthlyPremium: "" });
        setInsuranceExpenses([]);
      } finally { setInsuranceLoading(false); }
    })();
  }, [employeeId, tab]);

  // Load salary / income tabs
  useEffect(() => {
    if (!employeeId || (tab !== "salary" && tab !== "income")) return;
    setSalaryLoading(true);
    (async () => {
      try {
        const [histRes, payrollRes] = await Promise.all([
          api.get("/employees/me/salary-history"),
          api.get("/employees/me/payroll-summary"),
        ]);
        setHistory(histRes.data.data || []);
        // Chỉ hiện các kỳ đã thanh toán (Paid) — Draft/Approved là thông tin nội bộ
        const allPayrolls = payrollRes.data.data || [];
        setPayrollSummary(allPayrolls.filter((r) => r.status === "Paid"));
      } catch { setHistory([]); setPayrollSummary([]); }
      finally { setSalaryLoading(false); }
    })();
  }, [employeeId, tab]);

  const saveBank = async () => {
    setBankSaving(true);
    try {
      await api.patch("/employees/me/bank", {
        bankAccountNo: bankForm.bankAccountNo.trim() || null,
        bankName: bankForm.bankName.trim() || null,
        bankAccountName: bankForm.bankAccountName.trim() || null,
      });
      await refreshUser();
    } catch (e) { alert(e?.response?.data?.message || "Lỗi lưu ngân hàng"); }
    finally { setBankSaving(false); }
  };

  const totalHours = payrollSummary.reduce((s, r) => s + Number(r.workedHours), 0);
  const totalNet = payrollSummary.reduce((s, r) => s + Number(r.netSalary), 0);

  const TABS = [
    { id: "info",      label: "Thông tin" },
    { id: "insurance", label: "Bảo hiểm" },
    { id: "income",    label: "Thu nhập" },
    { id: "salary",    label: "Bậc lương" },
  ];

  if (!currentUser) return null;

  return (
    <div className="mt-4">
      <Typography variant="h5" color="blue-gray" className="mb-4">Thông tin cá nhân</Typography>

      {/* Tab bar */}
      <div className="flex border-b border-blue-gray-100 mb-4 gap-5 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-blue-gray-500 hover:text-blue-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Thông tin ────────────────────────────────────────────────── */}
      {tab === "info" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-gray-100 overflow-hidden">
            <div className="bg-blue-gray-50 px-4 py-2 text-xs font-semibold text-blue-gray-600 uppercase tracking-wide">Thông tin chung</div>
            <div className="divide-y divide-blue-gray-50">
              {[
                ["Họ tên",      currentUser.fullName],
                ["Mã NV",       currentUser.employeeCode],
                ["Username",    currentUser.username],
                ["Email",       currentUser.email],
                ["SĐT",         currentUser.phone || "—"],
                ["Cửa hàng",    currentUser.storeNames?.join(", ") || "—"],
                ["Vào làm",     currentUser.startDate ? formatDateVi(currentUser.startDate) : "—"],
                ["Thâm niên",   formatTenureVi(currentUser.startDate)],
                ["Lương/giờ",   formatHourlyRate(currentUser.currentSalary)],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center px-4 py-2.5 gap-3">
                  <span className="text-xs text-blue-gray-500 w-28 shrink-0">{label}</span>
                  <span className="text-sm text-blue-gray-800 font-medium">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tài khoản ngân hàng */}
          <div className="rounded-xl border border-blue-gray-100 overflow-hidden">
            <div className="bg-blue-gray-50 px-4 py-2 text-xs font-semibold text-blue-gray-600 uppercase tracking-wide">Tài khoản ngân hàng</div>
            <div className="p-4 space-y-3">
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
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Bảo hiểm ────────────────────────────────────────────────── */}
      {tab === "insurance" && (
        insuranceLoading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Đang tải...</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-gray-100 overflow-hidden">
              <div className="bg-blue-gray-50 px-4 py-2 text-xs font-semibold text-blue-gray-600 uppercase tracking-wide">Hình thức bảo hiểm</div>
              <div className="p-4 space-y-2 text-sm text-blue-gray-700">
                <div className="flex gap-2">
                  <span className="text-blue-gray-400 w-24 shrink-0">Loại:</span>
                  <span>{insurance.mode === "CompanyProvided" ? "Công ty cung cấp" : insurance.mode === "SelfPaid" ? "Tự mua" : "Không / chưa tham gia"}</span>
                </div>
                {insurance.mode === "CompanyProvided" && (
                  <div className="flex gap-2">
                    <span className="text-blue-gray-400 w-24 shrink-0">Mức trừ:</span>
                    <span>{insurance.insuranceRateCode || "—"}{insurance.insuranceRateLabel ? ` (${insurance.insuranceRateLabel})` : ""} {insurance.monthlyPremium ? `— ${Number(insurance.monthlyPremium).toLocaleString("vi-VN")} đ/tháng` : ""}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-blue-gray-400 w-24 shrink-0">Mã BHXH:</span>
                  <span>{insurance.bhxhNumber || "—"}</span>
                </div>
                {insurance.note && (
                  <div className="flex gap-2">
                    <span className="text-blue-gray-400 w-24 shrink-0">Ghi chú:</span>
                    <span>{insurance.note}</span>
                  </div>
                )}
              </div>
            </div>

            {insuranceExpenses.length > 0 && (
              <div className="rounded-xl border border-blue-gray-100 overflow-hidden">
                <div className="bg-blue-gray-50 px-4 py-2 text-xs font-semibold text-blue-gray-600 uppercase tracking-wide">Chi phí BH tự trả</div>
                <ul className="divide-y divide-blue-gray-50">
                  {insuranceExpenses.map((x) => (
                    <li key={x.id} className="flex justify-between px-4 py-2 text-sm">
                      <span className="text-blue-gray-600">{x.month}/{x.year}</span>
                      <span className="font-medium">{Number(x.amount).toLocaleString("vi-VN")} đ</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Tab: Thu nhập ────────────────────────────────────────────────── */}
      {tab === "income" && (
        salaryLoading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Đang tải...</p>
        ) : payrollSummary.length === 0 ? (
          <div className="rounded-xl border border-blue-gray-100 p-6 text-center text-sm text-gray-400">
            Chưa có kỳ lương nào đã thanh toán.
          </div>
        ) : (
          <div className="space-y-4">
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

            {/* Mobile: cards */}
            <div className="space-y-2 md:hidden">
              {payrollSummary.map((r) => (
                <div key={r.payrollId} className="rounded-xl border border-blue-gray-100 bg-white px-4 py-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm">T.{r.month}/{r.year}</span>
                    <span className="text-xs text-blue-gray-500">{r.storeName}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-blue-700 font-medium">{Number(r.workedHours).toFixed(1)}h</span>
                    <span className="font-bold text-green-700">{Number(r.netSalary).toLocaleString("vi-VN")} đ</span>
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
                    <th className="px-3 py-2.5 text-right">Đã nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollSummary.map((r, i) => (
                    <tr key={r.payrollId} className={i % 2 === 0 ? "bg-white" : "bg-blue-gray-50/40"}>
                      <td className="px-3 py-2 text-center font-medium">T.{r.month}/{r.year}</td>
                      <td className="px-3 py-2 text-blue-gray-600 max-w-[100px] truncate">{r.storeName}</td>
                      <td className="px-3 py-2 text-center font-semibold text-blue-700">{Number(r.workedHours).toFixed(1)}h</td>
                      <td className="px-3 py-2 text-right text-blue-gray-700">{Number(r.grossSalary ?? 0).toLocaleString("vi-VN")} đ</td>
                      <td className="px-3 py-2 text-right font-bold text-green-700">{Number(r.netSalary).toLocaleString("vi-VN")} đ</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold text-sm">
                    <td className="px-3 py-2.5 text-center" colSpan={2}>Tổng cộng</td>
                    <td className="px-3 py-2.5 text-center text-blue-700">{totalHours.toFixed(1)}h</td>
                    <td className="px-3 py-2.5 text-right text-blue-gray-700">—</td>
                    <td className="px-3 py-2.5 text-right text-green-700">{formatMoney(totalNet)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── Tab: Bậc lương ────────────────────────────────────────────────── */}
      {tab === "salary" && (
        salaryLoading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Đang tải...</p>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-blue-gray-100 p-6 text-center text-sm text-gray-400">
            Chưa có lịch sử bậc lương.
          </div>
        ) : (
          <div className="rounded-xl border border-blue-gray-100 overflow-hidden">
            <div className="bg-blue-gray-50 px-4 py-2 text-xs font-semibold text-blue-gray-600 uppercase tracking-wide">Lịch sử bậc lương</div>
            <ul className="divide-y divide-blue-gray-50">
              {history.map((row, idx) => (
                <li key={row.id} className={`px-4 py-3 text-sm flex justify-between items-center ${idx === 0 ? "bg-blue-50/60" : "bg-white"}`}>
                  <div>
                    <span className="font-semibold text-blue-gray-900">{formatHourlyRate(row)}</span>
                    {Number(row.coefficient) !== 1 && (
                      <span className="text-xs text-blue-gray-500 ml-2">× {row.coefficient}</span>
                    )}
                    {row.note && <p className="text-xs text-blue-gray-400 mt-0.5">{row.note}</p>}
                  </div>
                  <div className="text-xs text-blue-gray-400 text-right shrink-0">
                    {idx === 0 && <span className="text-blue-600 font-medium block">Hiện tại</span>}
                    từ {formatDateVi(row.effectiveFrom?.slice(0, 10))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  );
}
