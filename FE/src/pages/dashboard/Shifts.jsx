import { useState, useEffect } from "react";
import { useSortableTable } from "@/hooks/useSortableTable";
import SortIcon from "@/components/SortIcon";
import { Card, CardBody, Typography, Button, Input, Chip } from "@material-tailwind/react";
import { PlusIcon } from "@heroicons/react/24/solid";
import api from "@/api";
import { MobileCard, MobileListShell, MobileRow } from "@/components/mobile/MobileCard";

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ storeId: "", name: "", startTime: "", endTime: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [shiftRes, storeRes] = await Promise.all([api.get("/shifts"), api.get("/stores")]);
      setShifts(shiftRes.data.data || []);
      setStores(storeRes.data.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const { sorted, sortKey, sortDir, handleSort } = useSortableTable(shifts);

  const handleCreate = async () => {
    try {
      await api.post("/shifts", { ...form, storeId: Number(form.storeId) });
      setShowForm(false);
      load();
    } catch (e) { alert(e?.response?.data?.message || "Lỗi"); }
  };

  const toggleActive = async (s) => {
    try { await api.patch(`/shifts/${s.id}/toggle-active`); load(); }
    catch (e) { alert(e?.response?.data?.message || "Lỗi"); }
  };

  return (
    <div className="mt-4">
      <Card className="border border-blue-gray-100">
        <div className="p-4 border-b flex items-center justify-between">
          <Typography variant="h6" color="blue-gray">Quản lý Ca làm việc</Typography>
          <Button size="sm" className="flex items-center gap-1" onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="w-4 h-4" /> Thêm ca
          </Button>
        </div>
        <CardBody className="p-0">
          {showForm && (
            <div className="p-4 border-b bg-blue-50/40">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-blue-gray-500 mb-1 block">Cửa hàng *</label>
                  <select value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                    className="w-full rounded-lg border border-blue-gray-200 px-3 py-2.5 text-sm">
                    <option value="">Chọn cửa hàng</option>
                    {stores.filter(s => s.isActive).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <Input label="Tên ca *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input type="time" label="Giờ bắt đầu *" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                <Input type="time" label="Giờ kết thúc *" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={handleCreate}>Lưu</Button>
                <Button size="sm" variant="outlined" onClick={() => setShowForm(false)}>Hủy</Button>
              </div>
            </div>
          )}
          <MobileListShell loading={loading} empty={!loading && shifts.length === 0} emptyText="Chưa có ca nào" count={shifts.length}>
            {shifts.map((s) => (
              <MobileCard key={s.id}>
                <Typography variant="small" className="font-semibold">{s.name}</Typography>
                <MobileRow label="Cửa hàng">{s.storeName}</MobileRow>
                <MobileRow label="Giờ">{s.startTime} – {s.endTime}</MobileRow>
                <MobileRow label="Số giờ">{s.workHours.toFixed(1)}h</MobileRow>
                <MobileRow label="Trạng thái">
                  <Chip size="sm" color={s.isActive ? "green" : "gray"} value={s.isActive ? "Hoạt động" : "Tạm dừng"} className="w-fit ml-auto" />
                </MobileRow>
                <button type="button" onClick={() => toggleActive(s)} className={`text-xs font-medium pt-1 border-t border-blue-gray-100 ${s.isActive ? "text-red-500" : "text-green-600"}`}>
                  {s.isActive ? "Vô hiệu" : "Kích hoạt"}
                </button>
              </MobileCard>
            ))}
          </MobileListShell>

          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="px-4 py-2.5 text-center w-10">STT</th>
                <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("storeName")}>Cửa hàng <SortIcon active={sortKey === "storeName"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("name")}>Tên ca <SortIcon active={sortKey === "name"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("startTime")}>Giờ bắt đầu <SortIcon active={sortKey === "startTime"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("endTime")}>Giờ kết thúc <SortIcon active={sortKey === "endTime"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("workHours")}>Số giờ <SortIcon active={sortKey === "workHours"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("isActive")}>Trạng thái <SortIcon active={sortKey === "isActive"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400">Đang tải...</td></tr>
              ) : shifts.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400">Chưa có ca nào</td></tr>
              ) : sorted.map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}>
                  <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.storeName}</td>
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-center">{s.startTime}</td>
                  <td className="px-4 py-2.5 text-center">{s.endTime}</td>
                  <td className="px-4 py-2.5 text-center">{s.workHours.toFixed(1)}h</td>
                  <td className="px-4 py-2.5 text-center">
                    <Chip size="sm" color={s.isActive ? "green" : "gray"} value={s.isActive ? "Hoạt động" : "Tạm dừng"} className="w-fit mx-auto" />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => toggleActive(s)} className={`text-xs ${s.isActive ? "text-red-500" : "text-green-600"} hover:underline`}>
                      {s.isActive ? "Vô hiệu" : "Kích hoạt"}
                    </button>
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
