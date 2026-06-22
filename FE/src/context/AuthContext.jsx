import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import api from "@/api";

const AuthContext = createContext(null);
const WORK_MODE_KEY = "wf_work_mode";

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workMode, setWorkModeState] = useState(() => {
    if (typeof localStorage === "undefined") return "manager";
    return localStorage.getItem(WORK_MODE_KEY) === "employee" ? "employee" : "manager";
  });

  useEffect(() => {
    const token = localStorage.getItem("wf_access_token");
    if (token) {
      api.get("/auth/me")
        .then((res) => setCurrentUser(res.data.data))
        .catch(() => {
          localStorage.removeItem("wf_access_token");
          localStorage.removeItem("wf_refresh_token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await api.post("/auth/login", { username, password });
    const { accessToken, refreshToken, user } = res.data.data;
    localStorage.setItem("wf_access_token", accessToken);
    localStorage.setItem("wf_refresh_token", refreshToken);
    setCurrentUser(user);
    if (user?.role === "Manager" && !localStorage.getItem(WORK_MODE_KEY)) {
      localStorage.setItem(WORK_MODE_KEY, "manager");
      setWorkModeState("manager");
    }
    return user;
  };

  const refreshUser = async () => {
    const res = await api.get("/auth/me");
    setCurrentUser(res.data.data);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("wf_refresh_token");
    try { await api.post("/auth/logout", { refreshToken }); } catch {}
    localStorage.removeItem("wf_access_token");
    localStorage.removeItem("wf_refresh_token");
    setCurrentUser(null);
  };

  const setWorkMode = (mode) => {
    const m = mode === "employee" ? "employee" : "manager";
    localStorage.setItem(WORK_MODE_KEY, m);
    setWorkModeState(m);
  };

  const roleNorm = (currentUser?.role || "").trim();
  const isAdmin = roleNorm === "Admin";
  const isManager = roleNorm === "Manager";
  const isEmployee = roleNorm === "Employee";
  const isActingAsEmployee = isManager && workMode === "employee";
  const effectiveRole = useMemo(() => {
    if (!currentUser?.role) return "";
    if (isActingAsEmployee) return "Employee";
    return currentUser.role;
  }, [currentUser?.role, isActingAsEmployee]);

  const primaryStoreId = useMemo(() => {
    const u = currentUser;
    if (!u) return null;
    if (u.primaryStoreId != null) return Number(u.primaryStoreId);
    if (u.storeIds?.length) return Number(u.storeIds[0]);
    return null;
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{
      currentUser,
      loading,
      login,
      logout,
      refreshUser,
      isAdmin,
      isManager,
      isEmployee,
      isActingAsEmployee,
      effectiveRole,
      workMode,
      setWorkMode,
      primaryStoreId,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
