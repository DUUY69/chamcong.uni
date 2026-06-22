import { useState, useMemo } from "react";

/**
 * Hook sắp xếp bảng dữ liệu theo cột.
 * Hỗ trợ: số, boolean, chuỗi số, chuỗi văn bản (so sánh tiếng Việt).
 */
export function useSortableTable(data) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey || !data?.length) return data ?? [];
    return [...data].sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "boolean") {
        if (va === vb) return 0;
        return sortDir === "asc" ? (va ? -1 : 1) : (va ? 1 : -1);
      }
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const na = Number(va), nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb) && String(va).trim() !== "" && String(vb).trim() !== "") {
        return sortDir === "asc" ? na - nb : nb - na;
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      const cmp = sa.localeCompare(sb, "vi");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, handleSort };
}
