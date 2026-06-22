import { useState, useEffect, useMemo } from "react";
import { Typography, Button, Chip } from "@material-tailwind/react";
import { XMarkIcon, Bars3Icon } from "@heroicons/react/24/solid";
import api from "@/api";
import { MobileField, MobileSelect, MobileTextInput } from "@/components/mobile/MobileCard";
import { formatShiftTime, formatWorkDateLabel, groupShiftsByStore, shiftStatusColor, shiftStatusLabel, sortShiftsPendingFirst } from "@/utils/shiftFormat";
import { countApprovedDistinct, staffingStatusLabel } from "@/utils/scheduleStaffing";
import { SHIFT_SLOTS, slotForReg, slotsForReg, countActiveInSlot, isSlotOverCapacity, MAX_STAFF_PER_SLOT } from "@/utils/scheduleSlots";

function formatDateLabel(dateStr) {
  return formatWorkDateLabel(dateStr);
}

const statusColors = { Pending: "blue", Approved: "green", Rejected: "red", Cancelled: "gray" };
const statusLabels = { Pending: "Chờ duyệt", Approved: "Đã duyệt", Rejected: "Từ chối", Cancelled: "Đã hủy" };

function RegCard({ reg, onDragStart, onEdit, draggable = true }) {
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.setData("regId", String(reg.id)); onDragStart?.(reg.id); }}
      className={`rounded-lg border px-2.5 py-2 text-xs cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${
        reg.status === "Approved"
          ? "border-green-300 bg-green-50"
          : "border-blue-300 bg-blue-50"
      }`}
      onClick={() => onEdit(reg)}
    >
      <div className="flex items-start gap-1.5">
        <Bars3Icon className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-blue-gray-900 truncate">{reg.employeeName}</div>
          <div className="text-blue-gray-600">{reg.startTime} – {reg.endTime}</div>
          <div className="text-blue-gray-500 truncate">{reg.storeName}</div>
        </div>
        <Chip size="sm" color={statusColors[reg.status]} value={statusLabels[reg.status]} className="normal-case shrink-0 text-[10px]" />
      </div>
    </div>
  );
}

export default function ManagerShiftDayPanel({
  open, dateStr, dayRegs, stores, requiredStaff = 5, readOnly = false, onClose, onSaved,
  onRegPatch, onRegRemove,
}) {
  const [panelTab, setPanelTab] = useState("view");
  const [filterStore, setFilterStore] = useState("");
  const [draggingId, setDraggingId] = useState(null);
  const [editReg, setEditReg] = useState(null);
  const [editForm, setEditForm] = useState({ storeId: "", startTime: "", endTime: "" });
  const [saving, setSaving] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const activeRegs = useMemo(
    () => dayRegs.filter((r) => {
      if (r.status !== "Pending" && r.status !== "Approved") return false;
      if (filterStore && String(r.storeId) !== filterStore) return false;
      return true;
    }),
    [dayRegs, filterStore]
  );

  const pendingRegs = activeRegs.filter((r) => r.status === "Pending");
  const approvedCount = countApprovedDistinct(activeRegs);
  const meetsTarget = approvedCount >= requiredStaff;
  const shortOfTarget = Math.max(0, requiredStaff - approvedCount);

  const storeGroups = useMemo(() => {
    const groups = groupShiftsByStore(activeRegs, stores).map((g) => ({
      ...g,
      items: sortShiftsPendingFirst(g.items),
    }));
    return groups.sort((a, b) => b.pendingCount - a.pendingCount || String(a.storeName).localeCompare(String(b.storeName), "vi"));
  }, [activeRegs, stores]);

  const regsBySlot = useMemo(() => {
    const m = Object.fromEntries(SHIFT_SLOTS.map((s) => [s.id, []]));
    activeRegs.forEach((r) => {
      for (const slotId of slotsForReg(r)) {
        if (m[slotId]) m[slotId].push(r);
      }
    });
    for (const key of Object.keys(m)) {
      m[key] = sortShiftsPendingFirst(m[key]);
    }
    return m;
  }, [activeRegs]);

  useEffect(() => {
    if (!open) {
      setEditReg(null);
      setFilterStore("");
      setPanelTab("view");
      return;
    }
    if (stores.length >= 1) {
      setFilterStore((prev) =>
        prev && stores.some((s) => String(s.id) === prev) ? prev : String(stores[0].id)
      );
    }
  }, [open, dateStr, stores]);

  if (!open || !dateStr) return null;

  const handleDropOnSlot = async (slotId, regIdStr) => {
    const regId = Number(regIdStr || draggingId);
    const reg = activeRegs.find((r) => r.id === regId);
    const slot = SHIFT_SLOTS.find((s) => s.id === slotId);
    if (!reg || !slot) return;

    try {
      await api.patch(`/shift-registrations/${reg.id}/reassign`, {
        storeId: reg.storeId,
        startTime: slot.start,
        endTime: slot.end,
      });
      onSaved?.();
    } catch (e) {
      alert(e?.response?.data?.message || "Lỗi phân công");
    } finally {
      setDraggingId(null);
    }
  };

  const approve = async (id) => {
    onRegPatch?.(id, { status: "Approved" });
    try {
      await api.patch(`/shift-registrations/${id}/approve`);
    } catch (e) {
      const msg = e?.response?.data?.message || "Lỗi";
      alert(msg);
      onSaved?.();
    }
  };

  const reject = async (id) => {
    const reason = prompt("Lý do từ chối (tùy chọn):");
    if (reason === null) return;
    onRegRemove?.(id);
    try {
      await api.patch(`/shift-registrations/${id}/reject`, { rejectReason: reason });
    } catch (e) {
      alert(e?.response?.data?.message || "Lỗi");
      onSaved?.();
    }
  };

  const approveAll = async () => {
    if (!pendingRegs.length) return;
    const toApprove = sortShiftsPendingFirst(pendingRegs);
    const targetNote = meetsTarget
      ? ` (đã vượt mục tiêu ${requiredStaff} NV)`
      : ` (mục tiêu ${requiredStaff} NV)`;
    if (!confirm(`Duyệt ${toApprove.length} ca chờ duyệt?${targetNote}`)) return;
    setBulkLoading(true);
    for (const r of toApprove) onRegPatch?.(r.id, { status: "Approved" });
    try {
      for (const r of toApprove) {
        await api.patch(`/shift-registrations/${r.id}/approve`);
      }
    } catch (e) {
      alert(e?.response?.data?.message || "Lỗi duyệt");
      onSaved?.();
    } finally {
      setBulkLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editReg) return;
    setSaving(true);
    try {
      await api.patch(`/shift-registrations/${editReg.id}/reassign`, {
        storeId: Number(editForm.storeId),
        startTime: editForm.startTime,
        endTime: editForm.endTime,
      });
      setEditReg(null);
      onSaved?.();
    } catch (e) {
      alert(e?.response?.data?.message || "Lỗi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Đóng" />
      <div className="relative bg-white w-full sm:max-w-2xl max-h-[92vh] rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b">
          <div>
            <Typography variant="h6" color="blue-gray" className="text-base">Phân ca — {formatDateLabel(dateStr)}</Typography>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                meetsTarget ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
              }`}>
                {approvedCount} NV đã duyệt · mục tiêu {requiredStaff}
              </span>
              <span className="text-xs bg-blue-gray-100 text-blue-gray-700 px-2 py-0.5 rounded-full font-medium">
                {activeRegs.length} đăng ký
              </span>
              {pendingRegs.length > 0 && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                  {pendingRegs.length} chờ duyệt
                </span>
              )}
              {meetsTarget && (
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {staffingStatusLabel(approvedCount > requiredStaff ? "over" : "ok")}
                </span>
              )}
              {!meetsTarget && shortOfTarget > 0 && (
                <span className="text-xs bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                  Thiếu {shortOfTarget} NV so với mục tiêu
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-blue-gray-50">
            <XMarkIcon className="w-5 h-5 text-blue-gray-500" />
          </button>
        </div>

        <div className="px-4 py-2 border-b flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-blue-gray-200 overflow-hidden mr-auto">
            <button
              type="button"
              onClick={() => setPanelTab("view")}
              className={`px-3 py-1.5 text-xs font-medium ${panelTab === "view" ? "bg-blue-600 text-white" : "bg-white text-blue-gray-600"}`}
            >
              Xem theo CH
            </button>
            {!readOnly && (
            <button
              type="button"
              onClick={() => setPanelTab("manage")}
              className={`px-3 py-1.5 text-xs font-medium ${panelTab === "manage" ? "bg-blue-600 text-white" : "bg-white text-blue-gray-600"}`}
            >
              Phân ca / Duyệt
            </button>
            )}
          </div>
          {stores.length > 1 && (
            <MobileSelect
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              className="text-sm max-w-[200px]"
            >
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </MobileSelect>
          )}
          {!readOnly && panelTab === "manage" && pendingRegs.length > 0 && (
            <Button size="sm" color="green" onClick={approveAll} disabled={bulkLoading} className="normal-case">
              {bulkLoading ? "Đang duyệt..." : `Duyệt tất cả ${pendingRegs.length} ca`}
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {panelTab === "view" || readOnly ? (
            <>
              <p className="text-xs text-blue-gray-500">
                {readOnly
                  ? "Chế độ xem — sắp xếp theo cửa hàng. QL cửa hàng thực hiện duyệt và phân ca."
                  : <>Chỉ xem — sắp xếp theo cửa hàng. Bấm <strong>Phân ca / Duyệt</strong> nếu cần duyệt hoặc kéo thả phân ca.</>}
              </p>
              {storeGroups.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Không có ca trong ngày này.</p>
              ) : storeGroups.map((g) => (
                <div key={g.storeId ?? g.storeName} className="rounded-xl border border-blue-gray-200 overflow-hidden">
                  <div className="bg-blue-gray-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-blue-gray-900">{g.storeName}</span>
                    <span className="text-xs text-blue-gray-600">{g.items.length} ca · {g.pendingCount} chờ duyệt</span>
                  </div>
                  <ul className="divide-y divide-blue-gray-100">
                    {g.items.map((r) => (
                      <li key={r.id} className="px-3 py-2.5 text-sm flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold text-blue-gray-900">{r.employeeName}</span>
                          <span className="text-blue-gray-600 ml-2">{formatShiftTime(r)}</span>
                          <Chip size="sm" color={shiftStatusColor(r.status)} value={shiftStatusLabel(r.status)} className="normal-case ml-2 inline-flex" />
                        </div>
                        {!readOnly && r.status === "Pending" ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => approve(r.id)}
                              className="text-xs font-medium text-green-600"
                            >
                              Duyệt
                            </button>
                            <button type="button" onClick={() => reject(r.id)} className="text-xs text-red-500 font-medium">Từ chối</button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          ) : (
          <>
          <p className="text-xs text-blue-gray-500 italic">
            Kéo thẻ nhân viên sang ca sáng/chiều để phân công. Ca 08:00–17:00 hiện trên <strong>cả 2 ca</strong>. Quá {MAX_STAFF_PER_SLOT} NV/ca → đỏ cảnh báo.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SHIFT_SLOTS.map((slot) => {
              const slotCount = regsBySlot[slot.id]?.length || 0;
              const slotStoreId = filterStore || activeRegs[0]?.storeId;
              const slotOver = slotStoreId && isSlotOverCapacity(dayRegs, slotStoreId, dateStr, slot.id);
              return (
              <div
                key={slot.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnSlot(slot.id, e.dataTransfer.getData("regId"));
                }}
                className={`rounded-xl border-2 border-dashed p-2 min-h-[120px] transition-colors ${
                  slotOver
                    ? "border-red-400 bg-red-50/60"
                    : draggingId
                      ? "border-blue-400 bg-blue-50/40"
                      : "border-blue-gray-200 bg-blue-gray-50/30"
                }`}
              >
                <div className="text-center mb-2 pb-2 border-b border-blue-gray-200">
                  <div className="text-xs font-bold text-blue-gray-800">{slot.label}</div>
                  <div className="text-[10px] text-blue-gray-500">{slot.sub}</div>
                  <div className={`text-[10px] font-medium mt-0.5 ${slotOver ? "text-red-700" : "text-blue-600"}`}>
                    {slotStoreId ? countActiveInSlot(dayRegs, slotStoreId, dateStr, slot.id) : slotCount}/{MAX_STAFF_PER_SLOT} NV
                    {slotOver ? " · Vượt mức" : ""}
                  </div>
                </div>
                <div className="space-y-2">
                  {(regsBySlot[slot.id] || []).map((r) => (
                    <RegCard
                      key={r.id}
                      reg={r}
                      onDragStart={setDraggingId}
                      onEdit={(reg) => {
                        setEditReg(reg);
                        setEditForm({
                          storeId: String(reg.storeId),
                          startTime: reg.startTime,
                          endTime: reg.endTime,
                        });
                      }}
                    />
                  ))}
                </div>
              </div>
            );
            })}
          </div>

          {/* Edit panel */}
          {editReg && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-3">
              <Typography variant="small" className="font-bold text-blue-gray-900">
                Sửa phân công: {editReg.employeeName}
              </Typography>
              <MobileField label="Cửa hàng (vị trí)">
                <MobileSelect value={editForm.storeId} onChange={(e) => setEditForm({ ...editForm, storeId: e.target.value })}>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </MobileSelect>
              </MobileField>
              <div className="grid grid-cols-2 gap-3">
                <MobileField label="Từ giờ">
                  <MobileTextInput type="time" value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} />
                </MobileField>
                <MobileField label="Đến giờ">
                  <MobileTextInput type="time" value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} />
                </MobileField>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={saveEdit} disabled={saving}>
                  {saving ? "Đang lưu..." : "Lưu phân công"}
                </Button>
                {editReg.status === "Pending" && (
                  <>
                    <Button size="sm" color="green" variant="outlined" onClick={() => approve(editReg.id)}>Duyệt</Button>
                    <Button size="sm" color="red" variant="outlined" onClick={() => reject(editReg.id)}>Từ chối</Button>
                  </>
                )}
                <Button size="sm" variant="text" onClick={() => setEditReg(null)}>Đóng</Button>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
