import axios from "axios";

// Dev: để trống BASE_URL → Vite proxy /api → http://localhost:5000 (xem vite.config.js)
// Prod/Vercel: để trống VITE_API_BASE_URL → gọi /api cùng origin
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("wf_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("wf_refresh_token");
      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: newRefresh } = res.data.data;
          localStorage.setItem("wf_access_token", accessToken);
          localStorage.setItem("wf_refresh_token", newRefresh);
          original.headers.Authorization = `Bearer ${accessToken}`;
          return api(original);
        } catch {
          localStorage.removeItem("wf_access_token");
          localStorage.removeItem("wf_refresh_token");
          window.location.href = "/auth/login";
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
