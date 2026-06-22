const STATUS_LABELS = {
  Pending: "Chờ duyệt ca",
  Approved: "Đã duyệt ca",
  Rejected: "Từ chối",
  Cancelled: "Đã hủy",
};

const STATUS_COLORS = {
  Pending: "blue",      // Chờ duyệt ca
  Approved: "green",    // Đã duyệt ca
  Rejected: "red",
  Cancelled: "gray",
};

/** Khớp giờ sau khi QL kéo thả phân ca trên lưới. */
const MANAGER_SHIFT_SLOTS = [
  { label: "Ca sáng", start: "06:00", end: "14:00" },
  { label: "Ca chiều", start: "14:00", end: "22:00" },
  { label: "Ca full ngày", start: "08:00", end: "17:00" },
  { label: "Ca sáng", start: "07:00", end: "12:00" },
  { label: "Ca chiều", start: "12:00", end: "17:00" },
  { label: "Ca tối", start: "17:00", end: "22:00" },
];

function normalizeTime(t) {
  return (t || "").slice(0, 5);
}

export function matchManagerShiftSlot(r) {
  const s = normalizeTime(r?.startTime);
  const e = normalizeTime(r?.endTime);
  return MANAGER_SHIFT_SLOTS.find((x) => x.start === s && x.end === e) || null;
}

export function formatShiftTime(r) {
  const s = normalizeTime(r?.startTime);
  const e = normalizeTime(r?.endTime);
  if (s && e) {
    const slot = matchManagerShiftSlot(r);
    if (slot) return `${slot.label} · ${slot.start} – ${slot.end}`;
    return `${s} – ${e}`;
  }
  if (r?.shiftTime) return r.shiftTime;
  return "—";
}

export function formatWorkDateLabel(dateStr) {
  if (!dateStr) return "—";
  const d = dateStr.slice(0, 10);
  return new Date(`${d}T00:00:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatWorkDateShort(dateStr) {
  if (!dateStr) return "—";
  const d = dateStr.slice(0, 10);
  return new Date(`${d}T00:00:00`).toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export function shiftStatusLabel(status) {
  return STATUS_LABELS[status] || status || "—";
}

export function shiftStatusColor(status) {
  return STATUS_COLORS[status] || "gray";
}

/** Trạng thái chấm công (sau khi NV check-in/out, QL xác nhận). */
export function attendanceReviewLabel(reviewStatus, attendanceStatus) {
  if (reviewStatus === "Open") return "Đang làm";
  if (reviewStatus === "PendingReview") return "Chờ duyệt công";
  if (reviewStatus === "Confirmed" && attendanceStatus === "Absent") return "Vắng";
  if (reviewStatus === "Confirmed") return "Đã duyệt công";
  return null;
}

export function attendanceReviewColor(reviewStatus, attendanceStatus) {
  if (reviewStatus === "Open") return "cyan";           // Đang làm
  if (reviewStatus === "PendingReview") return "amber"; // Chờ duyệt công
  if (reviewStatus === "Confirmed" && attendanceStatus === "Absent") return "red";
  if (reviewStatus === "Confirmed") return "green";     // Đã duyệt công
  return "gray";
}

/** Một nhãn duy nhất trên lịch tuần: ưu tiên chấm công nếu đã có. */
export function weekBlockStatus(shiftStatus, attendance) {
  if (attendance) {
    const label = attendanceReviewLabel(attendance.reviewStatus, attendance.status);
    if (label) {
      return {
        label,
        color: attendanceReviewColor(attendance.reviewStatus, attendance.status),
      };
    }
  }
  return {
    label: shiftStatusLabel(shiftStatus),
    color: shiftStatusColor(shiftStatus),
  };
}

export function sortShiftsChronologically(list) {
  return [...list].sort((a, b) => {
    const dA = (a.workDate || "").slice(0, 10);
    const dB = (b.workDate || "").slice(0, 10);
    if (dA !== dB) return dA.localeCompare(dB);
    return String(a.startTime || "").localeCompare(String(b.startTime || ""));
  });
}

export function isActiveShiftStatus(status) {
  return status === "Pending" || status === "Approved";
}

export function sortShiftsPendingFirst(list) {
  const rank = { Pending: 0, Approved: 1, Rejected: 2, Cancelled: 3 };
  return [...list].sort((a, b) => {
    const sA = rank[a.status] ?? 9;
    const sB = rank[b.status] ?? 9;
    if (sA !== sB) return sA - sB;
    return String(a.startTime || "").localeCompare(String(b.startTime || ""));
  });
}

/** Nhóm ca theo cửa hàng → ngày → giờ (dễ xem / duyệt). */
export function groupShiftsByStore(regs, storeOrder = []) {
  const orderMap = new Map(storeOrder.map((s, i) => [String(s.id), i]));
  const groups = new Map();

  for (const r of regs) {
    const key = String(r.storeId ?? r.storeName ?? "unknown");
    if (!groups.has(key)) {
      groups.set(key, {
        storeId: r.storeId,
        storeName: r.storeName || "—",
        storeAddress: r.storeAddress || "",
        items: [],
      });
    }
    groups.get(key).items.push(r);
  }

  const list = Array.from(groups.values());
  list.forEach((g) => {
    g.items = sortShiftsChronologically(g.items);
    g.pendingCount = g.items.filter((x) => x.status === "Pending").length;
    g.approvedCount = g.items.filter((x) => x.status === "Approved").length;
  });

  list.sort((a, b) => {
    const ia = orderMap.has(String(a.storeId)) ? orderMap.get(String(a.storeId)) : 9999;
    const ib = orderMap.has(String(b.storeId)) ? orderMap.get(String(b.storeId)) : 9999;
    if (ia !== ib) return ia - ib;
    return String(a.storeName).localeCompare(String(b.storeName), "vi");
  });

  return list;
}

export function sortRegsByStoreThenDate(regs, storeOrder = []) {
  return groupShiftsByStore(regs, storeOrder).flatMap((g) => g.items);
}
