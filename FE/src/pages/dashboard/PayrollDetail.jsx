import { useState, useEffect, useMemo } from "react";
import { useSortableTable } from "@/hooks/useSortableTable";
import SortIcon from "@/components/SortIcon";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardBody, Typography, Button, Chip } from "@material-tailwind/react";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { MobileCard, MobileListShell, MobileRow, MobileField, MobileTextInput } from "@/components/mobile/MobileCard";
import { PayslipLines } from "@/components/PayslipLines";
import { formatHourlyRate } from "@/utils/formatMoney";
import { formatBankLine } from "@/components/BankInfoModal";
import { buildReturnSearch } from "@/utils/urlFilters";

const statusColors = { Draft: "indigo", Approved: "blue", Paid: "green" };
const statusLabels = { Draft: "Nháp", Approved: "Đã duyệt", Paid: "Đã trả" };

function calcNet(d) {
  return Number(d.grossSalary) + Number(d.bonus) + Number(d.deliveryAllowance || 0) - Number(d.deduction);
}

export default function PayrollDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backToList = () => navigate(`/dashboard/payroll${buildReturnSearch(location)}`);
  const { isEmployee } = useAuth();
  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/payrolls/${id}`);
      const data = res.data.data;
      setPayroll(data);
      const init = {};
      (data?.details || []).forEach((d) => {
        init[d.id] = {
          deliveryAllowance: d.deliveryAllowance ? String(d.deliveryAllowance) : "",
          note: d.note || "",
        };
      });
      setEdits(init);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const details = payroll?.details ?? [];
  const { sorted, sortKey, sortDir, handleSort } = useSortableTable(details);
  const isDraft = payroll?.status === "Draft" && !isEmployee;
  const myLine = isEmployee ? details[0] : null;

  const totalAmount = useMemo(() => {
    if (!payroll) return 0;
    return details.reduce((s, d) => {
      const e = edits[d.id];
      const allowance = e ? Number(e.deliveryAllowance || 0) : Number(d.deliveryAllowance || 0);
      return s + Number(d.grossSalary) + Number(d.bonus) + allowance - Number(d.deduction);
    }, 0);
  }, [payroll, details, edits]);

  const setEdit = (detailId, field, value) => {
    setEdits((prev) => ({ ...prev, [detailId]: { ...prev[detailId], [field]: value } }));
  };

  const saveRow = async (d) => {
    const e = edits[d.id] || {};
    setSavingId(d.id);
    try {
      await api.put(`/payrolls/${id}/details/${d.id}`, {
        deliveryAllowance: Number(e.deliveryAllowance || 0),
        note: e.note || null,
      });
      await load();
    } catch (err) {
      alert(err?.response?.data?.message || "Lỗi lưu");
    } finally { setSavingId(null); }
  };

  if (loading) return <div className="mt-12 text-center text-gray-400">Đang tải...</div>;
  if (!payroll) return <div className="mt-12 text-center text-red-400">Không tìm thấy bảng lương.</div>;

  if (isEmployee && myLine) {
    return (
      <div className="mt-4 max-w-lg mx-auto">
        <button onClick={backToList} className="flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">
          <ArrowLeftIcon className="w-4 h-4" /> Quay lại
        </button>
        <Card className="border border-blue-gray-100">
          <div className="p-4 border-b">
            <Typography variant="h6" color="blue-gray">Phiếu lương T.{payroll.month}/{payroll.year}</Typography>
            <Typography variant="small" color="gray">{payroll.storeName}</Typography>
            <Chip size="sm" className="mt-2 w-fit normal-case" color={statusColors[payroll.status] || "gray"}
              value={statusLabels[payroll.status] || payroll.status} />
          </div>
          <CardBody className="p-4">
            <PayslipLines d={myLine} />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <button onClick={backToList} className="flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> Quay lại
      </button>
      <Card className="border border-blue-gray-100">
        <div className="p-4 border-b">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Typography variant="h6" color="blue-gray">{payroll.storeName} — Tháng {payroll.month}/{payroll.year}</Typography>
              <Typography variant="small" color="gray">Tổng: {totalAmount.toLocaleString("vi-VN")} đ</Typography>
            </div>
            <Chip size="sm" color={statusColors[payroll.status] || "gray"} value={statusLabels[payroll.status] || payroll.status} />
          </div>
          {isDraft && (
            <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Bảng lương đang ở trạng thái Nháp — nhập <strong>Phụ cấp</strong> và <strong>Ghi chú</strong> (VD: giao hàng, bán thêm…) rồi bấm Lưu từng dòng.
            </p>
          )}
        </div>
        <CardBody className="p-0">
          <MobileListShell loading={false} empty={details.length === 0} emptyText="Không có dữ liệu" count={details.length}>
            {details.map((d) => {
              const e = edits[d.id] || {};
              const net = calcNet({ ...d, deliveryAllowance: e.deliveryAllowance ?? d.deliveryAllowance });
              return (
                <MobileCard key={d.id}>
                  <Typography variant="small" className="font-semibold">{d.employeeName}</Typography>
                  <Typography variant="small" color="gray" className="text-xs font-mono">{d.employeeCode}</Typography>
                  <MobileRow label="Lương gộp">{Number(d.grossSalary).toLocaleString("vi-VN")} đ</MobileRow>
                  {isDraft ? (
                    <>
                      <MobileField label="Phụ cấp (đ)">
                        <MobileTextInput type="number" min={0} placeholder="0"
                          value={e.deliveryAllowance ?? ""}
                          onChange={(ev) => setEdit(d.id, "deliveryAllowance", ev.target.value)} />
                      </MobileField>
                      <MobileField label="Ghi chú phụ cấp">
                        <MobileTextInput placeholder="VD: 5 chuyến giao hàng..."
                          value={e.note ?? ""}
                          onChange={(ev) => setEdit(d.id, "note", ev.target.value)} />
                      </MobileField>
                      <Button size="sm" className="mt-1" onClick={() => saveRow(d)} disabled={savingId === d.id}>
                        {savingId === d.id ? "Đang lưu..." : "Lưu"}
                      </Button>
                    </>
                  ) : (
                    <>
                      {Number(d.deliveryAllowance) > 0 && (
                        <MobileRow label="Phụ cấp">{Number(d.deliveryAllowance).toLocaleString("vi-VN")} đ</MobileRow>
                      )}
                      {d.note && <MobileRow label="Ghi chú">{d.note}</MobileRow>}
                    </>
                  )}
                  <MobileRow label="Thực nhận"><span className="font-bold">{net.toLocaleString("vi-VN")} đ</span></MobileRow>
                </MobileCard>
              );
            })}
          </MobileListShell>

          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="px-4 py-2.5 text-center w-10">STT</th>
                <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("employeeName")}>Nhân viên <SortIcon active={sortKey === "employeeName"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("workedDays")}>Ngày công <SortIcon active={sortKey === "workedDays"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("workedHours")}>Số giờ <SortIcon active={sortKey === "workedHours"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-right">Lương/giờ</th>
                <th className="px-4 py-2.5 text-right cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("grossSalary")}>Lương gộp <SortIcon active={sortKey === "grossSalary"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-right cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("bonus")}>Thưởng <SortIcon active={sortKey === "bonus"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-right cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("deliveryAllowance")}>Phụ cấp <SortIcon active={sortKey === "deliveryAllowance"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-left">Ghi chú</th>
                <th className="px-4 py-2.5 text-right cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("deduction")}>Khấu trừ <SortIcon active={sortKey === "deduction"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-right font-bold cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("netSalary")}>Thực nhận <SortIcon active={sortKey === "netSalary"} dir={sortDir} /></th>
                {isDraft && <th className="px-4 py-2.5 text-center w-20">Lưu</th>}
              </tr>
            </thead>
            <tbody>
              {details.length === 0 ? (
                <tr><td colSpan={isDraft ? 12 : 11} className="py-10 text-center text-gray-400">Không có dữ liệu</td></tr>
              ) : sorted.map((d, i) => {
                const e = edits[d.id] || {};
                const net = calcNet({ ...d, deliveryAllowance: e.deliveryAllowance ?? d.deliveryAllowance });
                return (
                  <tr key={d.id} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}>
                    <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium">{d.employeeName} <span className="text-xs text-gray-400">({d.employeeCode})</span></td>
                    <td className="px-4 py-2.5 text-center">{d.workedDays}</td>
                    <td className="px-4 py-2.5 text-center">{Number(d.workedHours).toFixed(1)}h</td>
                    <td className="px-4 py-2.5 text-right">{formatHourlyRate(d)}</td>
                    <td className="px-4 py-2.5 text-right">{Number(d.grossSalary).toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">{d.bonus > 0 ? `+${Number(d.bonus).toLocaleString("vi-VN")}` : "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      {isDraft ? (
                        <input type="number" min={0} placeholder="0"
                          className="w-28 text-right rounded border border-blue-gray-200 px-2 py-1 text-sm"
                          value={e.deliveryAllowance ?? ""}
                          onChange={(ev) => setEdit(d.id, "deliveryAllowance", ev.target.value)} />
                      ) : (
                        <span className="text-amber-600">{d.deliveryAllowance > 0 ? `+${Number(d.deliveryAllowance).toLocaleString("vi-VN")}` : "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isDraft ? (
                        <input type="text" placeholder="Ghi chú phụ cấp..."
                          className="w-full min-w-[140px] rounded border border-blue-gray-200 px-2 py-1 text-sm"
                          value={e.note ?? ""}
                          onChange={(ev) => setEdit(d.id, "note", ev.target.value)} />
                      ) : (
                        <span className="text-gray-600 text-xs">{d.note || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-red-500">{d.deduction > 0 ? `-${Number(d.deduction).toLocaleString("vi-VN")}` : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-blue-gray-800">{net.toLocaleString("vi-VN")} đ</td>
                    {isDraft && (
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => saveRow(d)} disabled={savingId === d.id}
                          className="text-xs text-blue-600 hover:underline disabled:text-gray-400">
                          {savingId === d.id ? "..." : "Lưu"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
