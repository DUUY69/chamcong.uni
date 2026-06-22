# Chấm công UNI (Workforce Management)

App quản lý nhân sự, chấm công, ca làm, lương — **BE** (.NET 8) + **FE** (React/Vite).

## Cấu trúc

- `BE/` — API `WorkforceManagement.Api`
- `FE/` — Dashboard chấm công

## Chạy local

**Backend** (mặc định port 5001):

```bash
cd BE
dotnet run
```

Tạo `appsettings.Development.json` với connection string SQL Server (xem `BE/DEPLOY.md`).

**Frontend**:

```bash
cd FE
npm install
cp .env.example .env
npm run dev
```

## Deploy

Xem `BE/DEPLOY.md` và `FE/DEPLOY.md` trong từng thư mục.
