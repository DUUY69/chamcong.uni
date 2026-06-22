/** Màu ô lưới phân ca — dùng class + inline để không bị Tailwind/opacity làm trắng. */

export function isRegApproved(reg) {
  return String(reg?.status || "").toLowerCase() === "approved";
}

export const SCHEDULE_CELL = {
  approved: {
    className: "bg-green-500 border-green-600 text-white",
    style: { backgroundColor: "#22c55e", borderColor: "#16a34a", color: "#ffffff" },
  },
  pending: {
    className: "bg-blue-600 border-blue-700 text-white",
    style: { backgroundColor: "#2563eb", borderColor: "#1d4ed8", color: "#ffffff" },
  },
};

export function scheduleCellTone(reg) {
  return isRegApproved(reg) ? SCHEDULE_CELL.approved : SCHEDULE_CELL.pending;
}
