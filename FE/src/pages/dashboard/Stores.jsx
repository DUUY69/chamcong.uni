import { useState, useEffect } from "react";
import { useSortableTable } from "@/hooks/useSortableTable";
import SortIcon from "@/components/SortIcon";
import { Card, CardBody, Typography, Button, Chip } from "@material-tailwind/react";
import { PlusIcon } from "@heroicons/react/24/solid";
import api from "@/api";
import {
  MobileCard, MobileListShell, MobileRow, MobileField, MobileTextInput, MobileSelect,
  CompactFormPanel,
} from "@/components/mobile/MobileCard";

const emptyForm = () => ({
  name: "", address: "", phone: "",
  standardWorkHoursPerDay: "8", overtimeRateMultiplier: "1.5",
  managerEmployeeId: "",
});

export default function Stores() {
  const [stores, setStores] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    setLoading(true);
    try {
      const [storesRes, empRes] = await Promise.all([
        api.get("/stores"),
        api.get("/employees?isActive=true"),
      ]);
      setStores(storesRes.data.data || []);
      const mgrs = (empRes.data.data || []).filter((e) => e.role === "Manager");
      setManagers(mgrs);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const { sorted, sortKey, sortDir, handleSort } = useSortableTable(stores);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name, address: s.address || "", phone: s.phone || "",
      standardWorkHoursPerDay: String(s.standardWorkHoursPerDay ?? 8),
      overtimeRateMultiplier: String(s.overtimeRateMultiplier ?? 1.5),
      managerEmployeeId: s.managerEmployeeId ? String(s.managerEmployeeId) : "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name,
      address: form.address,
      phone: form.phone,
      standardWorkHoursPerDay: Number(form.standardWorkHoursPerDay),
      overtimeRateMultiplier: Number(form.overtimeRateMultiplier),
      managerEmployeeId: form.managerEmployeeId ? Number(form.managerEmployeeId) : null,
    };
    try {
      if (editing) await api.put(`/stores/${editing.id}`, payload);
      else await api.post("/stores", payload);
      setShowForm(false);
      load();
    } catch (e) { alert(e?.response?.data?.message || "Lỗi"); }
  };

  const toggleActive = async (s) => {
    try { await api.patch(`/stores/${s.id}/toggle-active`); load(); }
    catch (e) { alert(e?.response?.data?.message || "Lỗi"); }
  };

  const managerLabel = (s) => {
    if (s.managerName) return `${s.managerName}${s.managerCode ? ` (${s.managerCode})` : ""}`;
    return "—";
  };

  return (
    <div className="mt-4">
      <Card className="border border-blue-gray-100">
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <Typography variant="h6" color="blue-gray">Quản lý Cửa hàng</Typography>
          <Button size="sm" className="flex items-center gap-1 w-full sm:w-auto justify-center" onClick={openCreate}>
            <PlusIcon className="w-4 h-4" /> Thêm cửa hàng
          </Button>
        </div>
        <CardBody className="p-0">
          {showForm && (
            <CompactFormPanel
              title={editing ? "Sửa cửa hàng" : "Thêm cửa hàng mới"}
              onSave={handleSave}
              onCancel={() => setShowForm(false)}
            >
              <MobileField label="Tên cửa hàng" required className="col-span-2">
                <MobileTextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </MobileField>
              <MobileField label="Địa chỉ" className="col-span-2">
                <MobileTextInput value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </MobileField>
              <MobileField label="SĐT">
                <MobileTextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </MobileField>
              <MobileField label="Quản lý cửa hàng" className="col-span-2">
                <MobileSelect
                  value={form.managerEmployeeId}
                  onChange={(e) => setForm({ ...form, managerEmployeeId: e.target.value })}
                >
                  <option value="">— Chưa gán —</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.fullName} ({m.employeeCode})</option>
                  ))}
                </MobileSelect>
              </MobileField>
              <MobileField label="Giờ chuẩn/ngày">
                <MobileTextInput type="number" value={form.standardWorkHoursPerDay}
                  onChange={(e) => setForm({ ...form, standardWorkHoursPerDay: e.target.value })} />
              </MobileField>
              <MobileField label="Hệ số OT">
                <MobileTextInput type="number" step="0.1" value={form.overtimeRateMultiplier}
                  onChange={(e) => setForm({ ...form, overtimeRateMultiplier: e.target.value })} />
              </MobileField>
            </CompactFormPanel>
          )}
          <MobileListShell loading={loading} empty={!loading && stores.length === 0} emptyText="Chưa có cửa hàng nào" count={stores.length}>
            {stores.map((s) => (
              <MobileCard key={s.id}>
                <Typography variant="small" className="font-semibold text-blue-gray-900">{s.name}</Typography>
                <MobileRow label="Quản lý">{managerLabel(s)}</MobileRow>
                <MobileRow label="Địa chỉ">{s.address || "—"}</MobileRow>
                <MobileRow label="SĐT">{s.phone || "—"}</MobileRow>
                <MobileRow label="Nhân viên">{s.employeeCount}</MobileRow>
                <MobileRow label="Trạng thái">
                  <Chip size="sm" color={s.isActive ? "green" : "gray"} value={s.isActive ? "Hoạt động" : "Tạm dừng"} className="w-fit ml-auto" />
                </MobileRow>
                <div className="flex gap-3 pt-1 border-t border-blue-gray-100">
                  <button type="button" onClick={() => openEdit(s)} className="text-xs text-blue-600 font-medium">Sửa</button>
                  <button type="button" onClick={() => toggleActive(s)} className={`text-xs font-medium ${s.isActive ? "text-red-500" : "text-green-600"}`}>
                    {s.isActive ? "Vô hiệu" : "Kích hoạt"}
                  </button>
                </div>
              </MobileCard>
            ))}
          </MobileListShell>

          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="px-4 py-2.5 text-center w-10">STT</th>
                <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("name")}>Tên cửa hàng <SortIcon active={sortKey === "name"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-left">Quản lý</th>
                <th className="px-4 py-2.5 text-left cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("address")}>Địa chỉ <SortIcon active={sortKey === "address"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-left">SĐT</th>
                <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("employeeCount")}>NV <SortIcon active={sortKey === "employeeCount"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-center cursor-pointer select-none hover:bg-blue-700" onClick={() => handleSort("isActive")}>Trạng thái <SortIcon active={sortKey === "isActive"} dir={sortDir} /></th>
                <th className="px-4 py-2.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400">Đang tải...</td></tr>
              ) : stores.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400">Chưa có cửa hàng nào</td></tr>
              ) : sorted.map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}>
                  <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{managerLabel(s)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.address || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.phone || "—"}</td>
                  <td className="px-4 py-2.5 text-center">{s.employeeCount}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Chip size="sm" color={s.isActive ? "green" : "gray"} value={s.isActive ? "Hoạt động" : "Tạm dừng"} className="w-fit mx-auto" />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(s)} className="text-blue-600 hover:underline text-xs">Sửa</button>
                      <button onClick={() => toggleActive(s)} className={`text-xs ${s.isActive ? "text-red-500" : "text-green-600"} hover:underline`}>
                        {s.isActive ? "Vô hiệu" : "Kích hoạt"}
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
    </div>
  );
}
