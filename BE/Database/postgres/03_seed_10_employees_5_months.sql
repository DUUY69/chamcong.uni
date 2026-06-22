-- NV005–NV014 + lịch sử 12/2025–04/2026 (đăng ký ca, chấm công, bảng lương)
-- Chạy sau 02_seed.sql

-- ── 1. Users + Employees ─────────────────────────────────────────────────────
INSERT INTO "Users" ("Username", "Email", "PasswordHash", "Role", "IsActive")
SELECT v.u, v.u || '@workforce.vn', '$2a$11$placeholder', 'Employee', TRUE
FROM (VALUES
    ('nv005'), ('nv006'), ('nv007'), ('nv008'), ('nv009'),
    ('nv010'), ('nv011'), ('nv012'), ('nv013'), ('nv014')
) AS v(u)
WHERE NOT EXISTS (SELECT 1 FROM "Users" x WHERE x."Username" = v.u);

INSERT INTO "Employees" ("UserId", "EmployeeCode", "FullName", "Phone", "StartDate", "IsActive")
SELECT u."Id", v.code, v.name, v.phone, v.start::date, TRUE
FROM (VALUES
    ('nv005', 'NV005', 'Hoàng Minh Tuấn',   '0945000005', '2025-06-01'),
    ('nv006', 'NV006', 'Võ Thị Hương',     '0945000006', '2025-07-01'),
    ('nv007', 'NV007', 'Đặng Quốc Huy',    '0945000007', '2025-07-15'),
    ('nv008', 'NV008', 'Bùi Thị Lan',       '0945000008', '2025-08-01'),
    ('nv009', 'NV009', 'Phan Văn Đức',     '0945000009', '2025-08-15'),
    ('nv010', 'NV010', 'Ngô Thị Mai',      '0945000010', '2025-09-01'),
    ('nv011', 'NV011', 'Lý Văn Phong',     '0945000011', '2025-09-15'),
    ('nv012', 'NV012', 'Đinh Thị Ngọc',    '0945000012', '2025-10-01'),
    ('nv013', 'NV013', 'Mai Văn Long',     '0945000013', '2025-10-15'),
    ('nv014', 'NV014', 'Tô Thị Hạnh',      '0945000014', '2025-11-01')
) AS v(uname, code, name, phone, start)
JOIN "Users" u ON u."Username" = v.uname
WHERE NOT EXISTS (SELECT 1 FROM "Employees" e WHERE e."EmployeeCode" = v.code);

INSERT INTO "EmployeeStores" ("EmployeeId", "StoreId")
SELECT e."Id", s."Id"
FROM (VALUES
    ('NV005', 'Passion Coffee - Q1'),
    ('NV006', 'Passion Coffee - Q1'),
    ('NV007', 'Passion Coffee - Q1'),
    ('NV008', 'Passion Coffee - Q1'),
    ('NV009', 'Passion Coffee - Q7'),
    ('NV010', 'Passion Coffee - Q7'),
    ('NV011', 'Passion Coffee - Q7'),
    ('NV012', 'Passion Coffee - Bình Thạnh'),
    ('NV013', 'Passion Coffee - Bình Thạnh'),
    ('NV014', 'Passion Coffee - Bình Thạnh')
) AS v(code, store_name)
JOIN "Employees" e ON e."EmployeeCode" = v.code
JOIN "Stores" s ON s."Name" = v.store_name
WHERE NOT EXISTS (
    SELECT 1 FROM "EmployeeStores" es
    WHERE es."EmployeeId" = e."Id" AND es."StoreId" = s."Id"
);

INSERT INTO "SalaryCoefficients" ("EmployeeId", "BaseSalaryPerHour", "Coefficient", "EffectiveFrom", "Note", "CreatedBy")
SELECT e."Id", v.hourly, 1.0, e."StartDate", 'Lương giờ seed NV005–NV014', a."Id"
FROM (VALUES
    ('NV005', 35000), ('NV006', 36000), ('NV007', 37000), ('NV008', 35500), ('NV009', 36500),
    ('NV010', 35000), ('NV011', 37500), ('NV012', 36000), ('NV013', 38000), ('NV014', 35500)
) AS v(code, hourly)
JOIN "Employees" e ON e."EmployeeCode" = v.code
CROSS JOIN "Users" a
WHERE a."Username" = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM "SalaryCoefficients" sc
    WHERE sc."EmployeeId" = e."Id" AND sc."EffectiveFrom" = e."StartDate"
  );

-- ── 2. Đăng ký ca + chấm công (5 tháng, T2–T6) ───────────────────────────────
WITH RECURSIVE nums AS (
    SELECT 0 AS d UNION ALL SELECT d + 1 FROM nums WHERE d < 30
),
months AS (
    SELECT DATE '2025-12-01' AS ms UNION ALL
    SELECT DATE '2026-01-01' UNION ALL SELECT DATE '2026-02-01' UNION ALL
    SELECT DATE '2026-03-01' UNION ALL SELECT DATE '2026-04-01'
),
work_days AS (
    SELECT (m.ms + n.d) AS work_date
    FROM months m
    CROSS JOIN nums n
    WHERE (m.ms + n.d) < (m.ms + INTERVAL '1 month')
      AND EXTRACT(ISODOW FROM (m.ms + n.d)) NOT IN (6, 7)
),
emp_store AS (
    SELECT e."Id" AS employee_id, e."EmployeeCode", es."StoreId" AS store_id
    FROM "Employees" e
    JOIN "EmployeeStores" es ON es."EmployeeId" = e."Id"
    WHERE e."EmployeeCode" >= 'NV005' AND e."EmployeeCode" <= 'NV014'
),
shift_rows AS (
    SELECT
        es.employee_id,
        es.store_id,
        wd.work_date,
        CASE ABS(hashtext(es.employee_id::text || wd.work_date::text)) % 3
            WHEN 0 THEN TIME '07:00' WHEN 1 THEN TIME '12:00' ELSE TIME '08:00'
        END AS start_time,
        CASE ABS(hashtext(es.employee_id::text || wd.work_date::text)) % 3
            WHEN 0 THEN TIME '12:00' ELSE TIME '17:00'
        END AS end_time
    FROM emp_store es
    CROSS JOIN work_days wd
    WHERE ABS(hashtext(es.employee_id::text || wd.work_date::text || '1')) % 5 <> 0
),
mgr AS (SELECT "Id" FROM "Users" WHERE "Username" = 'manager1' LIMIT 1)
INSERT INTO "ShiftRegistrations" (
    "EmployeeId", "ShiftId", "StartTime", "EndTime", "StoreId", "WorkDate",
    "Status", "ReviewedBy", "ReviewedAt"
)
SELECT
    x.employee_id, NULL, x.start_time, x.end_time, x.store_id, x.work_date,
    'Approved', mgr."Id", (x.work_date - INTERVAL '3 days')::timestamptz
FROM shift_rows x
CROSS JOIN mgr
WHERE NOT EXISTS (
    SELECT 1 FROM "ShiftRegistrations" r
    WHERE r."EmployeeId" = x.employee_id AND r."StoreId" = x.store_id
      AND r."WorkDate" = x.work_date AND r."StartTime" = x.start_time AND r."EndTime" = x.end_time
);

WITH admin AS (SELECT "Id" FROM "Users" WHERE "Username" = 'admin' LIMIT 1)
INSERT INTO "Attendances" (
    "EmployeeId", "StoreId", "WorkDate", "CheckIn", "CheckOut", "OvertimeHours", "Status", "CreatedBy"
)
SELECT
    x.employee_id, x.store_id, x.work_date, x.check_in, x.check_out,
    CASE WHEN x.worked_h > 8 THEN ROUND((x.worked_h - 8)::numeric, 2) ELSE 0 END,
    'Worked', admin."Id"
FROM (
    SELECT
        r."EmployeeId" AS employee_id,
        r."StoreId" AS store_id,
        r."WorkDate" AS work_date,
        r."StartTime" AS check_in,
        r."EndTime" AS check_out,
        EXTRACT(EPOCH FROM (r."EndTime" - r."StartTime")) / 3600.0 AS worked_h
    FROM "ShiftRegistrations" r
    JOIN "Employees" e ON e."Id" = r."EmployeeId"
    WHERE e."EmployeeCode" >= 'NV005' AND e."EmployeeCode" <= 'NV014'
      AND r."Status" = 'Approved'
      AND r."WorkDate" >= DATE '2025-12-01' AND r."WorkDate" < DATE '2026-05-01'
) x
CROSS JOIN admin
WHERE NOT EXISTS (
    SELECT 1 FROM "Attendances" a
    WHERE a."EmployeeId" = x.employee_id AND a."StoreId" = x.store_id AND a."WorkDate" = x.work_date
);

-- ── 3. Bảng lương 12/2025–04/2026 ────────────────────────────────────────────
DO $$
DECLARE
    v_admin INT;
    v_store RECORD;
    v_pm RECORD;
    v_df DATE;
    v_dt DATE;
    v_payroll_id INT;
    v_ot NUMERIC;
BEGIN
    SELECT "Id" INTO v_admin FROM "Users" WHERE "Username" = 'admin' LIMIT 1;

    FOR v_store IN SELECT "Id", "OvertimeRateMultiplier" FROM "Stores" WHERE "IsActive" = TRUE LOOP
        v_ot := v_store."OvertimeRateMultiplier";
        FOR v_pm IN
            SELECT * FROM (VALUES
                (2025, 12, 'Paid'),
                (2026, 1, 'Paid'),
                (2026, 2, 'Paid'),
                (2026, 3, 'Approved'),
                (2026, 4, 'Approved')
            ) AS t(y, m, st)
        LOOP
            v_df := make_date(v_pm.y, v_pm.m, 1);
            v_dt := (v_df + INTERVAL '1 month' - INTERVAL '1 day')::date;

            SELECT "Id" INTO v_payroll_id FROM "Payrolls"
            WHERE "StoreId" = v_store."Id" AND "Year" = v_pm.y AND "Month" = v_pm.m;

            IF v_payroll_id IS NULL THEN
                INSERT INTO "Payrolls" ("StoreId", "Month", "Year", "Status", "TotalAmount", "CreatedBy", "ApprovedBy", "ApprovedAt")
                VALUES (
                    v_store."Id", v_pm.m, v_pm.y, v_pm.st, 0, v_admin,
                    CASE WHEN v_pm.st IN ('Approved', 'Paid') THEN v_admin END,
                    CASE WHEN v_pm.st IN ('Approved', 'Paid') THEN NOW() AT TIME ZONE 'utc' END
                )
                RETURNING "Id" INTO v_payroll_id;
            END IF;

            DELETE FROM "PayrollDetails" WHERE "PayrollId" = v_payroll_id;

            INSERT INTO "PayrollDetails" (
                "PayrollId", "EmployeeId", "WorkedDays", "WorkedHours", "OvertimeHours",
                "BaseSalaryPerHour", "Coefficient", "GrossSalary", "Bonus", "Deduction"
            )
            SELECT
                v_payroll_id,
                agg.employee_id,
                agg.worked_days,
                agg.worked_hours,
                agg.overtime_hours,
                agg.hourly,
                agg.coeff,
                ROUND((agg.regular_h * agg.hourly + agg.overtime_hours * agg.hourly * v_ot) * agg.coeff, 0),
                0, 0
            FROM (
                SELECT
                    a."EmployeeId" AS employee_id,
                    COUNT(*)::numeric AS worked_days,
                    SUM(EXTRACT(EPOCH FROM (a."CheckOut" - a."CheckIn")) / 3600.0) AS worked_hours,
                    SUM(a."OvertimeHours") AS overtime_hours,
                    SUM(EXTRACT(EPOCH FROM (a."CheckOut" - a."CheckIn")) / 3600.0) - SUM(a."OvertimeHours") AS regular_h,
                    COALESCE((
                        SELECT sc."BaseSalaryPerHour"
                        FROM "SalaryCoefficients" sc
                        WHERE sc."EmployeeId" = a."EmployeeId" AND sc."EffectiveFrom" <= v_df
                        ORDER BY sc."EffectiveFrom" DESC LIMIT 1
                    ), 0) AS hourly,
                    COALESCE((
                        SELECT sc."Coefficient"
                        FROM "SalaryCoefficients" sc
                        WHERE sc."EmployeeId" = a."EmployeeId" AND sc."EffectiveFrom" <= v_df
                        ORDER BY sc."EffectiveFrom" DESC LIMIT 1
                    ), 1.0) AS coeff
                FROM "Attendances" a
                JOIN "EmployeeStores" es ON es."EmployeeId" = a."EmployeeId" AND es."StoreId" = v_store."Id"
                WHERE a."StoreId" = v_store."Id"
                  AND a."WorkDate" BETWEEN v_df AND v_dt
                  AND a."Status" = 'Worked' AND a."CheckOut" IS NOT NULL
                GROUP BY a."EmployeeId"
            ) agg
            WHERE agg.worked_days > 0;

            UPDATE "Payrolls"
            SET "TotalAmount" = COALESCE((
                    SELECT SUM("GrossSalary" + "Bonus" - "Deduction")
                    FROM "PayrollDetails" WHERE "PayrollId" = v_payroll_id
                ), 0),
                "Status" = v_pm.st
            WHERE "Id" = v_payroll_id;
        END LOOP;
    END LOOP;
END $$;
