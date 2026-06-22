import { useEffect, useState } from "react";
import { Dialog, DialogHeader, DialogBody, DialogFooter, Button, Typography } from "@material-tailwind/react";
import { MobileField, MobileTextInput } from "@/components/mobile/MobileCard";
import api from "@/api";
import { useAuth } from "@/context/AuthContext";

const empty = { bankAccountNo: "", bankName: "", bankAccountName: "" };

export function formatBankLine(emp) {
  if (!emp?.bankAccountNo && !emp?.bankName) return "—";
  const parts = [emp.bankName, emp.bankAccountNo].filter(Boolean);
  const name = emp.bankAccountName ? ` (${emp.bankAccountName})` : "";
  return parts.join(" · ") + name;
}

export default function BankInfoModal({ open, employee, canEdit, onClose, onSaved }) {
  const { currentUser } = useAuth();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !employee) return;
    setForm({
      bankAccountNo: employee.bankAccountNo || "",
      bankName: employee.bankName || "",
      bankAccountName: employee.bankAccountName || employee.fullName || "",
    });
  }, [open, employee]);

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        bankAccountNo: form.bankAccountNo.trim() || null,
        bankName: form.bankName.trim() || null,
        bankAccountName: form.bankAccountName.trim() || null,
      };
      const isOwnProfile =
        employee.id === "me" ||
        !employee.id ||
        (currentUser?.employeeId != null && Number(employee.id) === Number(currentUser.employeeId));
      const url = isOwnProfile ? "/employees/me/bank" : `/employees/${employee.id}/bank`;
      await api.patch(url, body);
      onSaved?.();
      onClose();
    } catch (e) {
      alert(e?.response?.data?.message || "Lỗi lưu thông tin ngân hàng");
    } finally {
      setSaving(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} handler={onClose} size="sm">
      <DialogHeader>Thông tin chuyển lương</DialogHeader>
      <DialogBody className="space-y-3">
        <Typography variant="small" color="gray">
          {employee.fullName}
          {employee.employeeCode ? ` · ${employee.employeeCode}` : ""}
        </Typography>
        {canEdit ? (
          <>
            <MobileField label="Tên ngân hàng">
              <MobileTextInput
                placeholder="VD: Vietcombank, Techcombank"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              />
            </MobileField>
            <MobileField label="Số tài khoản (STK)">
              <MobileTextInput
                placeholder="Chỉ nhập số, không dấu cách"
                value={form.bankAccountNo}
                onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value.replace(/\s/g, "") })}
              />
            </MobileField>
            <MobileField label="Tên chủ tài khoản">
              <MobileTextInput
                placeholder="Viết hoa không dấu (theo ngân hàng)"
                value={form.bankAccountName}
                onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
              />
            </MobileField>
          </>
        ) : (
          <div className="text-sm space-y-1">
            <p><strong>Ngân hàng:</strong> {form.bankName || "—"}</p>
            <p><strong>STK:</strong> {form.bankAccountNo || "—"}</p>
            <p><strong>Chủ TK:</strong> {form.bankAccountName || "—"}</p>
          </div>
        )}
      </DialogBody>
      <DialogFooter className="gap-2">
        <Button variant="text" onClick={onClose}>Đóng</Button>
        {canEdit && (
          <Button onClick={save} disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu"}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
