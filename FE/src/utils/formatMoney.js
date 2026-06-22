/** Lấy đơn giá/giờ từ currentSalary (hỗ trợ tên field cũ baseSalaryPerDay). */
export function getHourlyRate(salary) {
  if (!salary || typeof salary !== "object") return null;
  const raw = salary.baseSalaryPerHour ?? salary.baseSalaryPerDay;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function formatHourlyRate(salary) {
  const n = getHourlyRate(salary);
  if (n == null) return "—";
  return `${n.toLocaleString("vi-VN")} đ/giờ`;
}

export function formatMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("vi-VN")} đ`;
}
