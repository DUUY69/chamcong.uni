/** Thống kê số NV theo cửa hàng từ đăng ký ca (distinct employeeId). */

function dayKey(workDate) {
  return String(workDate ?? "").slice(0, 10);
}

function countDistinctEmployees(items) {
  return new Set(items.map((r) => r.employeeId).filter(Boolean)).size;
}

/** Số NV được gán vào từng CH (pool). */
export function countAssignedEmployeesByStore(employees = []) {
  const map = new Map();
  for (const emp of employees) {
    const ids = emp.storeIds || [];
    for (const sid of ids) {
      map.set(sid, (map.get(sid) || 0) + 1);
    }
  }
  return map;
}

/** Theo 1 ngày: mỗi CH có bao nhiêu NV đã duyệt / chờ duyệt. */
export function buildStoreStaffingForDate(regs, stores, employees, dateStr) {
  const assignedMap = countAssignedEmployeesByStore(employees);
  const dayRegs = regs.filter((r) => dayKey(r.workDate) === dateStr);

  const rows = (stores || []).map((store) => {
    const sid = store.id;
    const storeRegs = dayRegs.filter((r) => Number(r.storeId) === Number(sid));
    const approvedRegs = storeRegs.filter((r) => r.status === "Approved");
    const pendingRegs = storeRegs.filter((r) => r.status === "Pending");

    return {
      storeId: sid,
      storeName: store.name || "—",
      assignedCount: assignedMap.get(sid) || 0,
      approvedCount: countDistinctEmployees(approvedRegs),
      pendingCount: countDistinctEmployees(pendingRegs),
      approvedShifts: approvedRegs.length,
      pendingShifts: pendingRegs.length,
      gap: Math.max(0, (assignedMap.get(sid) || 0) - countDistinctEmployees(approvedRegs)),
    };
  });

  rows.sort((a, b) => {
    const totalA = a.approvedCount + a.pendingCount;
    const totalB = b.approvedCount + b.pendingCount;
    if (totalB !== totalA) return totalB - totalA;
    return String(a.storeName).localeCompare(String(b.storeName), "vi");
  });

  const maxBar = Math.max(
    1,
    ...rows.map((r) => Math.max(r.assignedCount, r.approvedCount + r.pendingCount))
  );

  return { rows, maxBar, dateStr };
}

/** 7 ngày: ma trận NV đã duyệt theo CH (distinct / ngày). */
export function buildStoreStaffingWeek(regs, stores, weekDates) {
  const rows = (stores || []).map((store) => {
    const sid = store.id;
    const days = weekDates.map((d) => {
      const approved = regs.filter(
        (r) =>
          dayKey(r.workDate) === d &&
          Number(r.storeId) === Number(sid) &&
          r.status === "Approved"
      );
      return {
        date: d,
        approvedCount: countDistinctEmployees(approved),
        shiftCount: approved.length,
      };
    });
    const weekTotal = days.reduce((s, x) => s + x.approvedCount, 0);
    return { storeId: sid, storeName: store.name || "—", days, weekTotal };
  });

  rows.sort((a, b) => b.weekTotal - a.weekTotal || String(a.storeName).localeCompare(String(b.storeName), "vi"));

  const maxCell = Math.max(1, ...rows.flatMap((r) => r.days.map((d) => d.approvedCount)));

  return { rows, maxCell, weekDates };
}

export function getWeekDatesFromMonday(refDate = new Date()) {
  const d = new Date(refDate);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    dates.push(x.toISOString().slice(0, 10));
  }
  return dates;
}

export function weekdayShort(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("vi-VN", { weekday: "short" });
}

export function dayMonthShort(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}
