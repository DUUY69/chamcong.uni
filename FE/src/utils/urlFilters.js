import { useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

/** Đường dẫn menu → key sessionStorage (giữ lọc khi bấm sidebar / bottom nav). */
export const LIST_FILTER_PATHS = {
  "/orders": "filters:/dashboard/orders",
  "/supplier-orders": "filters:/dashboard/supplier-orders",
  "/supplier-orders-admin": "filters:/dashboard/supplier-orders",
  "/products": "filters:/dashboard/products",
  "/product-demand": "filters:/dashboard/product-demand",
  "/reports": "filters:/dashboard/reports",
  "/eod-checkin": "filters:/dashboard/eod-checkin",
  "/eod-monthly-matrix": "filters:/dashboard/eod-monthly-matrix",
  "/suppliers": "filters:/dashboard/suppliers",
  "/warehouse": "filters:/dashboard/warehouse",
  "/home": "filters:/dashboard/home",
  "/shift-registrations": "filters:/dashboard/shift-registrations",
  "/attendance": "filters:/dashboard/attendance",
  "/employees": "filters:/dashboard/employees",
  "/payroll": "filters:/dashboard/payroll",
  "/reports-cc": "filters:/dashboard/reports",
};

export function dashboardPathWithSavedFilters(path) {
  const base = `/dashboard${path}`;
  const key = LIST_FILTER_PATHS[path];
  if (!key || typeof sessionStorage === "undefined") return base;
  try {
    const saved = sessionStorage.getItem(key);
    return saved ? `${base}?${saved.replace(/^\?/, "")}` : base;
  } catch {
    return base;
  }
}

function persistFilters(storageKey, searchParams) {
  if (!storageKey || typeof sessionStorage === "undefined") return;
  try {
    const s = searchParams.toString();
    if (s) sessionStorage.setItem(storageKey, s);
    else sessionStorage.removeItem(storageKey);
  } catch { /* ignore */ }
}

/** Đọc/ghi filter qua URL query — giữ lọc khi back / đổi menu rồi quay lại. */
export function useUrlFilters(defaults = {}, options = {}) {
  const { storageKey = null } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!storageKey || restoredRef.current) return;
    restoredRef.current = true;
    const hasUrlFilter = Object.keys(defaults).some((key) => {
      const v = searchParams.get(key);
      return v != null && v !== "";
    });
    if (hasUrlFilter) return;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (!saved) return;
      setSearchParams(new URLSearchParams(saved), { replace: true });
    } catch { /* ignore */ }
  }, [storageKey, defaults, searchParams, setSearchParams]);

  useEffect(() => {
    persistFilters(storageKey, searchParams);
  }, [storageKey, searchParams]);

  const values = useMemo(() => {
    const out = {};
    for (const [key, def] of Object.entries(defaults)) {
      const raw = searchParams.get(key);
      out[key] = raw != null && raw !== "" ? raw : (def ?? "");
    }
    return out;
  }, [searchParams, defaults]);

  const setFilter = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const def = defaults[key] ?? "";
      if (value == null || value === "" || String(value) === String(def)) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
      return next;
    }, { replace: true });
  }, [setSearchParams, defaults]);

  const setFilters = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        const def = defaults[key] ?? "";
        if (value == null || value === "" || String(value) === String(def)) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      return next;
    }, { replace: true });
  }, [setSearchParams, defaults]);

  const clearFilters = useCallback((keys = Object.keys(defaults)) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const key of keys) next.delete(key);
      return next;
    }, { replace: true });
  }, [setSearchParams, defaults]);

  const hasActiveFilters = useCallback((keys = Object.keys(defaults)) => {
    return keys.some((key) => {
      const v = searchParams.get(key);
      const def = defaults[key] ?? "";
      return v != null && v !== "" && String(v) !== String(def);
    });
  }, [searchParams, defaults]);

  const searchString = useMemo(() => {
    const s = searchParams.toString();
    return s ? `?${s}` : "";
  }, [searchParams]);

  return { values, setFilter, setFilters, clearFilters, hasActiveFilters, searchString, searchParams };
}

export function buildReturnSearch(location, storageKey = null) {
  if (location.state?.returnSearch) {
    const rs = location.state.returnSearch;
    if (typeof rs === "string" && rs.startsWith("?")) return rs;
    if (typeof rs === "string" && rs.length > 0) return `?${rs}`;
  }
  if (storageKey && typeof sessionStorage !== "undefined") {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return `?${saved.replace(/^\?/, "")}`;
    } catch { /* ignore */ }
  }
  return "";
}
