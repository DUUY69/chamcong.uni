/** Map date → labor summary (1 CH) hoặc gộp nhiều CH (admin). */
export function indexLaborSummaries(summaries = [], { singleStoreId } = {}) {
  const map = {};
  for (const row of summaries) {
    if (singleStoreId && Number(row.storeId) !== Number(singleStoreId)) continue;
    const d = row.date?.slice(0, 10);
    if (!d) continue;
    if (!map[d]) {
      map[d] = {
        date: d,
        employeeHours: Number(row.employeeHours) || 0,
        managerHours: Number(row.managerHours) || 0,
        employeeEstPay: Number(row.employeeEstPay) || 0,
        managerEstPay: Number(row.managerEstPay) || 0,
      };
    } else if (!singleStoreId) {
      map[d].employeeHours += Number(row.employeeHours) || 0;
      map[d].managerHours += Number(row.managerHours) || 0;
      map[d].employeeEstPay += Number(row.employeeEstPay) || 0;
      map[d].managerEstPay += Number(row.managerEstPay) || 0;
    }
  }
  return map;
}

export function formatLaborHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n) || n <= 0) return "0h";
  const rounded = Math.round(n * 10) / 10;
  return `${rounded.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}h`;
}
