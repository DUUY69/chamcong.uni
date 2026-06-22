# Workforce Management — Backend

ASP.NET Core 8 API quản lý nhân sự, chấm công, lương.

## Chạy local

```bash
cp appsettings.Development.json.example appsettings.Development.json
# Sửa ConnectionStrings trong appsettings.Development.json
dotnet run --urls http://localhost:5001
```

## Script DB

**PostgreSQL (khuyên dùng — VPS / Docker):**

1. `Database/postgres/01_schema.sql`
2. `Database/postgres/02_seed.sql`
3. `03_seed_10_employees_5_months.sql` → `04` → `04b` → `05` → `07_seed_bank_accounts.sql`
4. `POST /api/setup/reset-demo-passwords` (BCrypt mật khẩu demo)

**SQL Server (legacy, local cũ):**

1. `01_Schema.sql` → `03_SeedData_Real.sql` …
3. `04_Align_Attendance_Status.sql`
4. `05_Store_Work_Settings.sql`
5. `06_Salary_Per_Hour.sql`
6. `07_Seed_Demo_Data.sql`
7. `08_ShiftRegistration_CustomTimes.sql`
8. `09_Seed_10_Employees_5_Months.sql`
9. `12_Seed_Bank_Accounts.sql` — STK ngân hàng demo (NV001–NV014)

Tài khoản demo (sau seed `03`): `admin` / `Admin@123`, `manager1` / `Manager@123`, `nv001` / `Employee@123`.

Frontend: [workforce-management-FE](https://github.com/DUUY69/workforce-management-FE)

## Deploy (Render)

Xem [DEPLOY.md](./DEPLOY.md) — biến môi trường: `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Cors__Origins`. Health: `GET /health`.
