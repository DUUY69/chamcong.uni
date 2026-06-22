import { useState, useEffect, useCallback, useMemo } from "react";
import { useSortableTable } from "@/hooks/useSortableTable";
import SortIcon from "@/components/SortIcon";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, Typography, Button, Chip } from "@material-tailwind/react";
import { PlusIcon } from "@heroicons/react/24/solid";
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { fetchStores } from "@/utils/storesApi";
import { MobileCard, MobileListShell, MobileRow } from "@/components/mobile/MobileCard";
import { PayslipLines } from "@/components/PayslipLines";
import { useUrlFilters } from "@/utils/urlFilters";

const PAYROLL_FILTER_DEFAULTS = { storeId: "", month: "", year: "", status: "" };

const statusColors = { Draft: "indigo", Approved: "blue", Paid: "green" };
const statusLabels = { Draft: "Nháp", Approved: "Đã duyệt", Paid: "Đã trả" };

const sortPayrolls = (list) =>
  [...list].sort((a, b) => b.year - a.year || b.month - a.month || b.id - a.id);

const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
const yearOptions = [2026, 2025, 2024];

export default function Payroll() {
  const navigate = useNavigate();
  const { isAdmin, isManager, isEmployee } = useAuth();
  const canManage = isAdmin || isManager;

  const [payrolls, setPayrolls] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [emptyHint, setEmptyHint] = useState(null);
  const [generating, setGenerating] = useState(false);

  const { values, setFilter, setFilters, clearFilters, searchString } = useUrlFilters(PAYROLL_FILTER_DEFAULTS);
  const filter = values;
  const [genForm, setGenForm] = useState({
    storeId: "",
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
  });

  const load = useCallback(async () => {
    setLoading(true);
    setEmptyHint(null);
    try {
      if (isEmployee) {
        const payRes = await api.get("/payrolls/my");
        // Chỉ hiện kỳ đã trả — Draft/Approved là thông tin nội bộ
        const allPayrolls = sortPayrolls(payRes.data.data || []);
        setPayrolls(allPayrolls.filter((p) => p.status === "Paid"));
        setStores([]);
        return;
      }

      const params = new URLSearchParams();
      if (filter.storeId) params.set("storeId", filter.storeId);
      if (filter.month) params.set("month", filter.month);
      if (filter.year) params.set("year", filter.year);
      if (filter.status) params.set("status", filter.status);

      const [payRes, storeList] = await Promise.all([
        api.get(`/payrolls?${params}`),
        fetchStores(api, { isAdmin }),
      ]);
      const list = sortPayrolls(payRes.data.data || []);
      setPayrolls(list);
      setStores(storeList);

      if (list.length === 0 && !filter.storeId && !filter.month && !filter.year) {
        setEmptyHint(
          "Chưa có bảng lương. Bấm «Tính lương mới» sau khi đã có chấm công đã ra ca trong tháng."
        );
      }
    } catch {
      setPayrolls([]);
    } finally {
      setLoading(false);
    }
  }, [isEmployee, filter]);

  useEffect(() => { load(); }, [load]);

  const payrollsWithPeriod = useMemo(
    () => payrolls.map((p) => ({ ...p, period: p.year * 100 + p.month })),
    [payrolls]
  );
  const { sorted, sortKey, sortDir, handleSort } = useSortableTable(payrollsWithPeriod);


  const handleGenerate = async () => {
    if (!genForm.storeId) { alert("Chọn cửa hàng"); return; }
    setGenerating(true);
    try {
      await api.post("/payrolls/generate", {
        storeId: Number(genForm.storeId),
        month: Number(genForm.month),
        year: Number(genForm.year),
      });
      setShowGenerate(false);
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || "Không tạo được bảng lương");
    } finally {
      setGenerating(false);
    }
  };

  const openDetail = (p) => {
    navigate(`/dashboard/payroll/${p.id}`, { state: { returnSearch: searchString } });
  };

  return (
    <div className="mt-4">
      <Card className="border border-blue-gray-100">
        <div className="p-4 border-b flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <Typography variant="h6" color="blue-gray">Bảng lương</Typography>
            {canManage && (
              <Button size="sm" className="flex items-center gap-1 justify-center w-full sm:w-auto"
                onClick={() => setShowGenerate(!showGenerate)}>
                <PlusIcon className="w-4 h-4" /> Tính lương mới
              </Button>
            )}
          </div>

          {canManage && showGenerate && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-3">
              <Typography variant="small" className="font-semibold text-blue-gray-800">
                Tính lương theo cửa hàng & kỳ
              </Typography>
              <p className="text-xs text-blue-gray-600">
                Chỉ tính ca đã chấm ra, trạng thái Đi làm. Lương theo giờ × OT (hệ số cửa hàng).
                Sau khi tạo bảng lương (Nháp), vào chi tiết để nhập phụ cấp + ghi chú cho từng NV.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-blue-gray-600 font-medium mb-1 block">Cửa hàng *</label>
                  <select value={genForm.storeId} onChange={(e) => setGenForm({ ...genForm, storeId: e.target.value })}
                    className="w-full rounded-lg border border-blue-gray-200 px-3 py-2.5 text-sm bg-white">
                    <option value="">— Chọn —</option>
                    {stores.filter((s) => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-blue-gray-600 font-medium mb-1 block">Tháng *</label>
                  <select value={genForm.month} onChange={(e) => setGenForm({ ...genForm, month: e.target.value })}
                    className="w-full rounded-lg border border-blue-gray-200 px-3 py-2.5 text-sm bg-white">
                    {monthOptions.map((m) => <option key={m} value={m}>Tháng {m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-blue-gray-600 font-medium mb-1 block">Năm *</label>
                  <select value={genForm.year} onChange={(e) => setGenForm({ ...genForm, year: e.target.value })}
                    className="w-full rounded-lg border border-blue-gray-200 px-3 py-2.5 text-sm bg-white">
                    {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleGenerate} disabled={generating}>
                  {generating ? "Đang tính..." : "Tính lương"}
                </Button>
                <Button size="sm" variant="outlined" onClick={() => setShowGenerate(false)}>Hủy</Button>
              </div>
            </div>
          )}

          {canManage && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              <select value={filter.storeId} onChange={(e) => setFilter("storeId", e.target.value)}
                className="rounded-lg border border-blue-gray-200 px-2 py-2 text-sm bg-white col-span-2 sm:col-span-1">
                <option value="">Tất cả CH</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={filter.month} onChange={(e) => setFilter("month", e.target.value)}
                className="rounded-lg border border-blue-gray-200 px-2 py-2 text-sm bg-white">
                <option value="">Tất cả tháng</option>
                {monthOptions.map((m) => <option key={m} value={m}>T.{m}</option>)}
              </select>
              <select value={filter.year} onChange={(e) => setFilter("year", e.target.value)}
                className="rounded-lg border border-blue-gray-200 px-2 py-2 text-sm bg-white">
                <option value="">Tất cả năm</option>
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={filter.status} onChange={(e) => setFilter("status", e.target.value)}
                className="rounded-lg border border-blue-gray-200 px-2 py-2 text-sm bg-white">
                <option value="">Mọi TT</option>
                <option value="Draft">Nháp</option>
                <option value="Approved">Đã duyệt</option>
                <option value="Paid">Đã trả</option>
              </select>
              <button type="button" onClick={clearFilters}
                className="text-xs text-blue-600 font-medium py-2 hover:underline">
                Xóa lọc
              </button>
            </div>
          )}
        </div>

        <CardBody className="p-0">
          {!loading && payrolls.length === 0 && emptyHint && (
            <div className="p-4 mx-4 mt-4 mb-2 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-gray-700">
              {emptyHint}
              {canManage && (
                <button type="button" className="block mt-2 text-blue-600 font-medium text-xs"
                  onClick={() => setShowGenerate(true)}>
                  → Mở Tính lương mới
                </button>
              )}
            </div>
          )}

          <MobileListShell
            loading={loading}
            empty={!loading && payrolls.length === 0}
            emptyText={isEmployee ? "Chưa có phiếu lương" : "Chưa có bảng lương"}
            count={payrolls.length}
          >
            {payrolls.map((p) => (
              <MobileCard key={p.id} onClick={() => openDetail(p)}>
                <div className="flex justify-between items-start gap-2">
                  <Typography variant="small" className="font-semibold text-blue-gray-900">
                    {p.storeName || "Cửa hàng"} — T.{p.month}/{p.year}
                  </Typography>
                  {!isEmployee && (
                    <Chip size="sm" color={statusColors[p.status] || "gray"}
                      value={statusLabels[p.status] || p.status} className="shrink-0 normal-case" />
                  )}
                </div>
                {isEmployee && p.details?.[0] && (
                  <>
                    <PayslipLines d={p.details[0]} compact />
                    <MobileRow label="Thực nhận">
                      <span className="font-bold text-green-700">{Number(p.details[0].netSalary).toLocaleString("vi-VN")} đ</span>
                    </MobileRow>
                  </>
                )}
                {!isEmployee && (
                  <MobileRow label="Tổng lương">
                    {Number(p.totalAmount).toLocaleString("vi-VN")} đ
                  </MobileRow>
                )}
                <Typography variant="small" color="gray" className="text-xs mt-1">Chạm để xem chi tiết</Typography>
              </MobileCard>
            ))}
          </MobileListShell>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="px-4 py-2.5 text-center w-10">STT</th>
                  <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("storeName")}>Cửa hàng <SortIcon active={sortKey === "storeName"} dir={sortDir} /></th>
                  <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("period")}>Kỳ <SortIcon active={sortKey === "period"} dir={sortDir} /></th>
                  <th className="px-4 py-2.5 text-right cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("totalAmount")}>Tổng <SortIcon active={sortKey === "totalAmount"} dir={sortDir} /></th>
                  {!isEmployee && <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("status")}>Trạng thái <SortIcon active={sortKey === "status"} dir={sortDir} /></th>}
                  <th className="px-4 py-2.5 text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={isEmployee ? 5 : 6} className="py-10 text-center text-gray-400">Đang tải...</td></tr>
                ) : payrolls.length === 0 ? (
                  <tr><td colSpan={isEmployee ? 5 : 6} className="py-10 text-center text-gray-400">
                    {isEmployee ? "Chưa có kỳ lương nào đã thanh toán" : "Chưa có dữ liệu"}
                  </td></tr>
                ) : sorted.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}>
                    <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium">{p.storeName}</td>
                    <td className="px-4 py-2.5 text-center">T.{p.month}/{p.year}</td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {Number(p.totalAmount).toLocaleString("vi-VN")} đ
                    </td>
                    {!isEmployee && (
                      <td className="px-4 py-2.5 text-center">
                        <Chip size="sm" color={statusColors[p.status] || "gray"}
                          value={statusLabels[p.status] || p.status} className="w-fit mx-auto normal-case" />
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-center">
                      <button type="button" onClick={() => openDetail(p)}
                        className="text-xs text-blue-600 hover:underline">Xem</button>
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
