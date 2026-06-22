/** Đếm tên gọi (từ cuối) — trùng thì hiện họ tên đủ. */
export function buildEmployeeDisplayNameResolver(regs = []) {
  const counts = new Map();
  for (const r of regs) {
    const short = shortName(r.employeeName);
    if (!short) continue;
    counts.set(short, (counts.get(short) || 0) + 1);
  }
  return (fullName) => {
    const short = shortName(fullName);
    if (!short) return fullName || "";
    if ((counts.get(short) || 0) > 1) return String(fullName || "").trim();
    return short;
  };
}

export function shortName(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}
