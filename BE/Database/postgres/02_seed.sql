-- Seed cơ bản (mật khẩu: gọi POST /api/setup/reset-demo-passwords sau khi API chạy)
INSERT INTO "Users" ("Username", "Email", "PasswordHash", "Role", "IsActive")
SELECT v.u, v.e, '$2a$11$placeholder', v.r, TRUE
FROM (VALUES
    ('admin',    'admin@workforce.vn',    'Admin'),
    ('manager1', 'manager1@workforce.vn', 'Manager'),
    ('nv001',    'nv001@workforce.vn',    'Employee'),
    ('nv002',    'nv002@workforce.vn',    'Employee'),
    ('nv003',    'nv003@workforce.vn',    'Employee')
) AS v(u, e, r)
WHERE NOT EXISTS (SELECT 1 FROM "Users" x WHERE x."Username" = v.u);

INSERT INTO "Stores" ("Name", "Address", "Phone", "IsActive")
SELECT v.n, v.a, v.p, TRUE
FROM (VALUES
    ('Passion Coffee - Q1', '123 Nguyễn Huệ, Q1, TP.HCM', '028-1234-5678'),
    ('Passion Coffee - Q7', '456 Nguyễn Thị Thập, Q7, TP.HCM', '028-8765-4321'),
    ('Passion Coffee - Bình Thạnh', '789 Đinh Bộ Lĩnh, Bình Thạnh, TP.HCM', '028-3456-7890')
) AS v(n, a, p)
WHERE NOT EXISTS (SELECT 1 FROM "Stores" s WHERE s."Name" = v.n);

INSERT INTO "Employees" ("UserId", "EmployeeCode", "FullName", "Phone", "StartDate", "IsActive")
SELECT u."Id", v.code, v.name, v.phone, v.start::date, TRUE
FROM (VALUES
    ('manager1', 'NV001', 'Nguyễn Văn Quản Lý', '0901234567', '2024-01-01'),
    ('nv001',    'NV002', 'Trần Thị An',         '0912345678', '2024-03-01'),
    ('nv002',    'NV003', 'Lê Văn Bình',         '0923456789', '2024-06-01'),
    ('nv003',    'NV004', 'Phạm Thị Cúc',        '0934567890', '2025-01-01')
) AS v(uname, code, name, phone, start)
JOIN "Users" u ON u."Username" = v.uname
WHERE NOT EXISTS (SELECT 1 FROM "Employees" e WHERE e."EmployeeCode" = v.code);

INSERT INTO "EmployeeStores" ("EmployeeId", "StoreId")
SELECT e."Id", s."Id"
FROM (VALUES
    ('NV001', 'Passion Coffee - Q1'),
    ('NV001', 'Passion Coffee - Q7'),
    ('NV002', 'Passion Coffee - Q1'),
    ('NV003', 'Passion Coffee - Q1'),
    ('NV003', 'Passion Coffee - Q7'),
    ('NV004', 'Passion Coffee - Bình Thạnh')
) AS v(ecode, sname)
JOIN "Employees" e ON e."EmployeeCode" = v.ecode
JOIN "Stores" s ON s."Name" = v.sname
WHERE NOT EXISTS (
    SELECT 1 FROM "EmployeeStores" es
    WHERE es."EmployeeId" = e."Id" AND es."StoreId" = s."Id"
);

INSERT INTO "Shifts" ("StoreId", "Name", "StartTime", "EndTime")
SELECT s."Id", v.n, v.st::time, v.et::time
FROM (VALUES
    ('Passion Coffee - Q1', 'Ca sáng',  '07:00', '12:00'),
    ('Passion Coffee - Q1', 'Ca chiều', '12:00', '17:00'),
    ('Passion Coffee - Q1', 'Ca tối',   '17:00', '22:00'),
    ('Passion Coffee - Q1', 'Ca full',  '07:00', '17:00'),
    ('Passion Coffee - Q7', 'Ca sáng',  '07:00', '12:00'),
    ('Passion Coffee - Q7', 'Ca chiều', '12:00', '17:00'),
    ('Passion Coffee - Q7', 'Ca tối',   '17:00', '22:00'),
    ('Passion Coffee - Bình Thạnh', 'Ca sáng',  '07:00', '12:00'),
    ('Passion Coffee - Bình Thạnh', 'Ca chiều', '12:00', '17:00')
) AS v(store, n, st, et)
JOIN "Stores" s ON s."Name" = v.store
WHERE NOT EXISTS (
    SELECT 1 FROM "Shifts" sh WHERE sh."StoreId" = s."Id" AND sh."Name" = v.n
);

INSERT INTO "SalaryCoefficients" ("EmployeeId", "BaseSalaryPerHour", "Coefficient", "EffectiveFrom", "Note", "CreatedBy")
SELECT e."Id", v.hourly, v.coef, v.ef::date, v.note, u."Id"
FROM (VALUES
    ('NV001', 50000, 1.5, '2024-01-01', 'Lương giờ quản lý'),
    ('NV002', 37500, 1.0, '2024-03-01', 'Lương giờ khởi điểm'),
    ('NV003', 37500, 1.0, '2024-06-01', 'Lương giờ khởi điểm'),
    ('NV004', 35000, 1.0, '2025-01-01', 'Lương giờ khởi điểm')
) AS v(code, hourly, coef, ef, note)
JOIN "Employees" e ON e."EmployeeCode" = v.code
CROSS JOIN "Users" u
WHERE u."Username" = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM "SalaryCoefficients" sc
    WHERE sc."EmployeeId" = e."Id" AND sc."EffectiveFrom" = v.ef::date
  );

INSERT INTO "Attendances" ("EmployeeId", "StoreId", "WorkDate", "CheckIn", "CheckOut", "OvertimeHours", "Status", "CreatedBy")
SELECT e."Id", s."Id", d.wd::date, d.cin::time, d.cout::time, d.ot, 'Worked', u."Id"
FROM (VALUES
    ('NV002', '2026-05-02', '07:00', '12:00', 0),
    ('NV002', '2026-05-05', '07:00', '17:00', 2),
    ('NV002', '2026-05-06', '07:30', '12:00', 0),
    ('NV002', '2026-05-07', '07:00', '12:00', 0),
    ('NV003', '2026-05-02', '12:00', '17:00', 0),
    ('NV003', '2026-05-05', '12:00', '17:00', 0),
    ('NV003', '2026-05-08', '07:00', '12:00', 0),
    ('NV003', '2026-05-09', '07:00', '12:00', 0)
) AS d(ecode, wd, cin, cout, ot)
JOIN "Employees" e ON e."EmployeeCode" = d.ecode
JOIN "Stores" s ON s."Name" = 'Passion Coffee - Q1'
CROSS JOIN "Users" u
WHERE u."Username" = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM "Attendances" a
    WHERE a."EmployeeId" = e."Id" AND a."StoreId" = s."Id" AND a."WorkDate" = d.wd::date
  );
