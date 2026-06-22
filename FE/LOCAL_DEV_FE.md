# Hướng dẫn chạy Frontend (FE) LOCAL trên máy này

**Máy hiện tại:** `DESKTOP-MAVAC1K`  
**Ngày:** 27/05/2026  
**Mục tiêu:** Chạy React + Vite frontend (port 5174) và kết nối với Backend local (port 5001) bạn đang setup.

> **Yêu cầu trước:**  
> Backend (BE) phải đang chạy thành công tại `http://localhost:5001` (xem file `BE/LOCAL_DEV_SQLSERVER.md`).

---

## Bước 1: Kiểm tra môi trường Node.js (đã có sẵn)

Máy bạn đã cài Node.js và npm:

- Node: `v22.22.0`
- npm: `11.13.0`

Rất tốt, không cần cài thêm.

Kiểm tra nhanh (mở PowerShell mới):

```powershell
node --version
npm --version
```

---

## Bước 2: Cấu hình file .env cho local

File `.env` hiện tại đã được set đúng cho local:

```env
VITE_API_BASE_URL=http://localhost:5001
VITE_USE_API=true
```

**Không cần thay đổi gì** nếu bạn chạy BE local trên cổng 5001.

Nếu sau này bạn muốn FE gọi trực tiếp qua Vite proxy (không cần set VITE_API_BASE_URL), bạn có thể để trống dòng `VITE_API_BASE_URL`.

---

## Bước 3: Cài đặt dependencies

Mở PowerShell, chạy:

```powershell
cd e:\AdminDasboard\workforce-management\FE

npm install
```

Lần đầu có thể mất 1-2 phút (tải các package React, Material Tailwind, Axios...).

---

## Bước 4: Chạy Frontend (Development)

**Quan trọng:** Chạy **Backend trước** (port 5001), sau đó mới chạy FE.

```powershell
# Terminal 1 (BE - đã chạy)
cd e:\AdminDasboard\workforce-management\BE
dotnet run --urls http://localhost:5001

# Terminal 2 (FE - mới)
cd e:\AdminDasboard\workforce-management\FE
npm run dev
```

FE sẽ chạy tại:

**http://localhost:5174**

Vite sẽ tự động mở trình duyệt. Nếu không, tự mở link trên.

---

## Cách hoạt động kết nối API (rất quan trọng)

FE sử dụng 2 cơ chế song song:

1. **Vite Dev Proxy** (trong `vite.config.js`)
   - Mọi request `/api/xxx` từ FE sẽ tự động được chuyển tiếp đến `http://localhost:5001`
   - Rất tiện, giảm lỗi CORS trong quá trình dev.

2. **Axios config** (`src/api/index.js` + `.env`)
   - Nếu `VITE_API_BASE_URL` có giá trị → dùng giá trị đó làm base URL.
   - Nếu không có → fallback về `http://localhost:5001` (khi dev) hoặc empty (khi production trên Vercel).

**Kết hợp cả 2** → local dev rất ổn định.

---

## Bước 5: Test nhanh sau khi chạy

1. Mở http://localhost:5174
2. Đăng nhập bằng tài khoản demo (sau khi đã seed DB cho BE):

   | Username | Password     | Vai trò   |
   |----------|--------------|-----------|
   | admin    | Admin@123    | Admin     |
   | manager1 | Manager@123  | Manager   |
   | nv001    | Employee@123 | Nhân viên |

3. Nếu login thành công và thấy Dashboard → mọi thứ đã hoạt động.

4. Kiểm tra kết nối API:
   - Mở DevTools (F12) → Network tab
   - Thử vào trang "Cửa hàng" hoặc "Nhân viên"
   - Bạn sẽ thấy các request đến `/api/stores`, `/api/employees`...

---

## Các vấn đề thường gặp & cách sửa

### 1. Lỗi CORS khi gọi API
- Nguyên nhân: BE chưa chạy hoặc chưa có CORS cho `http://localhost:5174`
- Giải pháp:
  - Đảm bảo BE đang chạy tại `http://localhost:5001`
  - Kiểm tra `BE/appsettings.Development.json` đã có dòng:
    ```json
    "Cors": { "Origins": "http://localhost:5174,http://localhost:5175,http://localhost:5176" }
    ```

### 2. FE báo "Network Error" hoặc không load dữ liệu
- Chạy BE trước, rồi mới chạy FE.
- Kiểm tra BE có in lỗi nào không trong terminal.

### 3. Port 5174 đã bị chiếm
- Dừng tiến trình đang dùng port 5174, hoặc đổi port tạm thời:
  ```powershell
  npm run dev -- --port 5175
  ```

### 4. Sau khi `npm install` bị lỗi
- Xóa thư mục `node_modules` + file `package-lock.json`, rồi chạy lại:
  ```powershell
  rm -r node_modules
  rm package-lock.json
  npm install
  ```

### 5. Muốn clear cache Vite
```powershell
npm run dev -- --force
```

---

## So sánh Local vs Production

| Môi trường     | API Base URL                  | Proxy / Rewrite                  |
|----------------|-------------------------------|----------------------------------|
| Local dev      | `http://localhost:5001`       | Vite proxy (`/api` → 5001)       |
| Vercel (prod)  | (để trống) hoặc domain custom | `vercel.json` rewrite → VPS      |
| .env.production| `http://workforce.unigroups.vn` | —                                |

---

## Chạy đồng thời BE + FE (khuyến nghị)

Mở **2 terminal** riêng biệt:

- **Terminal A**: Chạy BE (`dotnet run`)
- **Terminal B**: Chạy FE (`npm run dev`)

Hoặc dùng công cụ như `concurrently` (nâng cao, không bắt buộc).

---

## Tiếp theo sau khi chạy được

- Thử các chức năng cơ bản: xem cửa hàng, nhân viên, đăng ký ca, chấm công, tính lương.
- Kiểm tra xem dữ liệu từ script seed đã đầy đủ chưa (nếu thiếu thì chạy thêm script trong `BE/Database/`).
- Bắt đầu làm các task trong `docs/HANDOVER_BACKLOG.md`.

---

**File này được tạo song song với `BE/LOCAL_DEV_SQLSERVER.md` để bạn setup nhanh toàn bộ môi trường local.**

Nếu gặp lỗi cụ thể nào (paste output terminal), cứ gửi tôi sẽ hỗ trợ ngay.

Chúc bạn chạy thành công FE + BE local!
