/** Trạng thái nhân sự theo ngày — đủ / thiếu / dư so với RequiredStaffPerDay. */

export function staffingStatusLabel(status) {
  const map = {
    ok: "Đủ mục tiêu",
    under: "Thiếu người",
    over: "Vượt mục tiêu",
    none: "Chưa có ca",
  };
  return map[status] || status;
}

export function staffingStatusColor(status) {
  const map = {
    ok: "green",
    under: "amber",
    over: "blue",
    none: "gray",
  };
  return map[status] || "gray";
}

/** Map date → summary (1 CH) hoặc gộp nhiều CH (admin). */
export function indexStaffingSummaries(summaries = [], { singleStoreId } = {}) {
  const map = {};
  for (const row of summaries) {
    if (singleStoreId && Number(row.storeId) !== Number(singleStoreId)) continue;
    const d = row.date?.slice(0, 10);
    if (!d) continue;
    if (!map[d]) {
      map[d] = { ...row, date: d };
    } else if (!singleStoreId) {
      map[d].approvedCount += row.approvedCount;
      map[d].pendingCount += row.pendingCount;
      map[d].registeredCount += row.registeredCount;
      map[d].required = Math.max(map[d].required, row.required);
      map[d].status = mergeMultiStoreStatus(map[d], row);
    }
  }
  return map;
}

function mergeMultiStoreStatus(a, b) {
  if (a.status === "over" || b.status === "over") return "over";
  if (a.status === "under" || b.status === "under") return "under";
  if (a.status === "none" && b.status === "none") return "none";
  return "ok";
}

export function managerDayStaffingStyle(summary, dayRegs) {
  if (!summary) return managerDayStateFromRegs(dayRegs);
  const { status, approvedCount, required, pendingCount } = summary;
  if (status === "over") return "over";
  if (status === "none" && pendingCount === 0) return "empty";
  if (approvedCount >= required) return pendingCount > 0 ? "pending" : "approved";
  if (pendingCount > 0 || approvedCount > 0) return "under";
  return "empty";
}

function managerDayStateFromRegs(regs) {
  const active = (regs || []).filter((r) => r.status === "Pending" || r.status === "Approved");
  if (active.length === 0) return "empty";
  if (active.some((r) => r.status === "Pending")) return "pending";
  return "approved";
}

export function countApprovedDistinct(dayRegs = []) {
  return new Set(
    dayRegs.filter((r) => r.status === "Approved").map((r) => r.employeeId)
  ).size;
}

export function remainingApprovalSlots(dayRegs, required = 5) {
  const approved = countApprovedDistinct(dayRegs);
  return Math.max(0, required - approved);
}
