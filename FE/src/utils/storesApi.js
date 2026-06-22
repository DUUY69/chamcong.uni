/** Admin: tất cả CH; Manager/Employee: chỉ CH được gán. */
export async function fetchStores(api, { isAdmin } = {}) {
  const path = isAdmin ? "/stores" : "/stores/assigned";
  const res = await api.get(path);
  return res.data?.data || [];
}

/** Dropdown đăng ký ca — mọi CH đang hoạt động. */
export async function fetchStoreOptions(api) {
  const res = await api.get("/stores/options");
  return res.data?.data || [];
}
