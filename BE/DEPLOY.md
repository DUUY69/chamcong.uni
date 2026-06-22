# Deploy — Vercel (FE) + Render (BE)

## Tổng quan

| Thành phần | Nền tảng | Repo GitHub gợi ý |
|-----------|----------|-------------------|
| Frontend (Vite/React) | [Vercel](https://vercel.com) | `workforce-management-FE` |
| Backend (.NET 8 API) | [Render](https://render.com) | `workforce-management-BE` |
| Database | SQL Server (bên ngoài) | Azure SQL / VPS / máy có IP public |

Render **không** host SQL Server. Cần connection string tới SQL Server đã có sẵn (chạy script `Database/*.sql` trước).

---

## 1. Backend trên Render

### Bước 1 — Đẩy code BE lên GitHub

Repo root = root repo này (có file `WorkforceManagement.Api.csproj`).

### Bước 2 — Tạo Web Service

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
2. Connect repo `workforce-management-BE`
3. Cấu hình (chọn một):

**Cách A — Docker (khuyên dùng, có `Dockerfile` trong repo):**
   - **Runtime:** Docker
   - **Dockerfile Path:** `./Dockerfile`
   - **Health Check Path:** `/health`

**Cách B — .NET native:**
   - **Build Command:** `dotnet publish WorkforceManagement.Api.csproj -c Release -o ./publish`
   - **Start Command:** `dotnet ./publish/WorkforceManagement.Api.dll`
   - **Health Check Path:** `/health`

**Cách C — Blueprint:** New → **Blueprint** → repo có `render.yaml`.

### Bước 3 — Biến môi trường (Environment)

| Key | Ví dụ | Bắt buộc |
|-----|--------|----------|
| `ASPNETCORE_ENVIRONMENT` | `Production` | Có |
| `ASPNETCORE_URLS` | `http://0.0.0.0:10000` | Docker: có thể bỏ qua nếu dùng `PORT` |
| `PORT` | (Render tự set) | Docker / native trên Render |
| `ConnectionStrings__DefaultConnection` | `Server=...;Database=WorkforceManagement;User Id=...;Password=...;TrustServerCertificate=True;` | Có |
| `Jwt__Key` | Chuỗi bí mật **≥ 32 ký tự** | Có |
| `Jwt__Issuer` | `WorkforceManagement.Api` | Có |
| `Jwt__Audience` | `WorkforceManagement.Frontend` | Có |
| `Cors__Origins` | `https://your-app.vercel.app` | Có (URL Vercel, không dấu `/` cuối) |

Nhiều domain Vercel (preview + production):  
`https://xxx.vercel.app,https://yyy.vercel.app`

### Bước 4 — Kiểm tra

- `https://<tên-service>.onrender.com/health` → `{"status":"ok"}`
- `https://<tên-service>.onrender.com/api/setup/status` → JSON (sau khi đã seed DB)

Ghi lại URL API: `https://<tên-service>.onrender.com` (không có `/api` ở cuối).

---

## 2. Frontend trên Vercel

### Bước 1 — Đẩy code FE lên GitHub

Repo: [workforce-management-FE](https://github.com/DUUY69/workforce-management-FE)

### Bước 2 — Import project

1. [Vercel](https://vercel.com) → **Add New** → **Project** → chọn repo `workforce-management-FE`
2. **Framework Preset:** Vite
3. **Build Command:** `npm run build`
4. **Output Directory:** `dist`

### Bước 3 — Biến môi trường

| Key | Giá trị |
|-----|--------|
| `VITE_API_BASE_URL` | `https://<tên-service>.onrender.com` |

**Redeploy** sau khi đổi env.

---

## 3. Database (SQL Server)

Chạy trên DB production (một lần), theo thứ tự trong `README.md`:

`01_Schema` → `03_SeedData_Real` → `04` → `05` → `06` → `07` → `08` → (tuỳ chọn `09`, `10`, `11`)

Cho phép IP Render kết nối SQL (firewall Azure / security group).

---

## 4. Lưu ý

- **Free tier Render:** service sleep sau ~15 phút không dùng → request đầu có thể chậm ~30s.
- **HTTPS:** Vercel và Render đều có SSL; `VITE_API_BASE_URL` dùng `https://`.
- **CORS:** Nếu lỗi CORS trên trình duyệt, kiểm tra `Cors__Origins` khớp đúng domain Vercel.
- **Secrets:** Không commit `appsettings.Development.json` / `.env` có mật khẩu thật.
