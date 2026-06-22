-- Sửa tên tiếng Việt bị lỗi encoding (chạy file UTF-8 qua docker, không pipe PowerShell)
UPDATE "Employees" SET "FullName" = v.name
FROM (VALUES
    ('NV001', 'Nguyễn Văn Quản Lý'),
    ('NV002', 'Trần Thị An'),
    ('NV003', 'Lê Văn Bình'),
    ('NV004', 'Phạm Thị Cúc'),
    ('NV005', 'Hoàng Minh Tuấn'),
    ('NV006', 'Võ Thị Hương'),
    ('NV007', 'Đặng Quốc Huy'),
    ('NV008', 'Bùi Thị Lan'),
    ('NV009', 'Phan Văn Đức'),
    ('NV010', 'Ngô Thị Mai'),
    ('NV011', 'Lý Văn Phong'),
    ('NV012', 'Đinh Thị Ngọc'),
    ('NV013', 'Mai Văn Long'),
    ('NV014', 'Tô Thị Hạnh')
) AS v(code, name)
WHERE "Employees"."EmployeeCode" = v.code;

UPDATE "Stores" AS s SET
    "Name" = v.name,
    "Address" = v.addr
FROM (VALUES
    (1, 'Passion Coffee - Q1', '123 Nguyễn Huệ, Q1, TP.HCM'),
    (2, 'Passion Coffee - Q7', '456 Nguyễn Thị Thập, Q7, TP.HCM'),
    (3, 'Passion Coffee - Bình Thạnh', '789 Đinh Bộ Lĩnh, Bình Thạnh, TP.HCM')
) AS v(ord, name, addr)
WHERE s."Id" = (SELECT "Id" FROM "Stores" ORDER BY "Id" LIMIT 1 OFFSET v.ord - 1);

UPDATE "Shifts" SET "Name" = v.n
FROM (VALUES
    ('Ca sáng', 'Ca sáng'),
    ('Ca chiều', 'Ca chiều'),
    ('Ca tối', 'Ca tối'),
    ('Ca full', 'Ca full')
) AS v(old, n)
WHERE "Shifts"."Name" = v.old OR "Shifts"."Name" LIKE 'Ca %';

-- Sửa mọi ca bị lỗi theo pattern giờ (fallback)
UPDATE "Shifts" SET "Name" = 'Ca sáng'  WHERE "StartTime" = TIME '07:00' AND "EndTime" = TIME '12:00' AND "Name" NOT IN ('Ca sáng','Ca chiều','Ca tối','Ca full');
UPDATE "Shifts" SET "Name" = 'Ca chiều' WHERE "StartTime" = TIME '12:00' AND "EndTime" = TIME '17:00' AND "Name" NOT IN ('Ca sáng','Ca chiều','Ca tối','Ca full');
UPDATE "Shifts" SET "Name" = 'Ca tối'   WHERE "StartTime" = TIME '17:00' AND "EndTime" = TIME '22:00' AND "Name" NOT IN ('Ca sáng','Ca chiều','Ca tối','Ca full');
UPDATE "Shifts" SET "Name" = 'Ca full'  WHERE "StartTime" = TIME '07:00' AND "EndTime" = TIME '17:00' AND "Name" NOT IN ('Ca sáng','Ca chiều','Ca tối','Ca full');
