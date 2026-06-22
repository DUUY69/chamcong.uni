# Workforce Management — Frontend

React + Vite (port `5174`).

## Chạy local

**Máy bạn đang dùng:**  
Xem hướng dẫn chi tiết tại **`LOCAL_DEV_FE.md`** (đã chuẩn bị sẵn).

Tóm tắt nhanh:
1. `npm install`
2. Đảm bảo Backend đang chạy tại `http://localhost:5001`
3. `npm run dev` (FE sẽ chạy tại http://localhost:5174)

File `.env` hiện tại đã cấu hình đúng cho local.

Backend: [workforce-management-BE](https://github.com/DUUY69/workforce-management-BE)

## Deploy (Vercel)

Xem [DEPLOY.md](./DEPLOY.md) — set `VITE_API_BASE_URL` = URL Render API (https, không `/api` cuối).
