-- 10 nhân viên mới + 5 tháng lịch sử (đăng ký ca, chấm công, bảng lương)
-- Tháng: 12/2025, 01–04/2026 (trước tháng 5/2026)
-- Chạy sau: 03_SeedData_Real.sql, 04, 05, 06, 08
USE WorkforceManagement;
GO
SET NOCOUNT ON;

IF COL_LENGTH('dbo.ShiftRegistrations', 'StartTime') IS NULL
BEGIN
    RAISERROR(N'Chạy 08_ShiftRegistration_CustomTimes.sql trước.', 16, 1);
    RETURN;
END

DECLARE @adminId INT = (SELECT TOP 1 Id FROM dbo.Users WHERE Username = N'admin');
DECLARE @mgrId   INT = (SELECT TOP 1 Id FROM dbo.Users WHERE Username = N'manager1');
DECLARE @sQ1     INT = (SELECT TOP 1 Id FROM dbo.Stores WHERE Name LIKE N'%Q1%');
DECLARE @sQ7     INT = (SELECT TOP 1 Id FROM dbo.Stores WHERE Name LIKE N'%Q7%');
DECLARE @sBT     INT = (SELECT TOP 1 Id FROM dbo.Stores WHERE Name LIKE N'%Bình Thạnh%');

IF @adminId IS NULL OR @sQ1 IS NULL
BEGIN
    RAISERROR(N'Chạy 03_SeedData_Real.sql trước.', 16, 1);
    RETURN;
END

DECLARE @pwd NVARCHAR(200) = N'$2a$11$K8Ow3Ow3Ow3Ow3Ow3Ow3OeK8Ow3Ow3Ow3Ow3Ow3Ow3Ow3Ow3Ow2';

-- ── 1. Users + Employees (NV005–NV014) ─────────────────────────────────────────
;WITH nv AS (
    SELECT * FROM (VALUES
        (N'nv005', N'NV005', N'Hoàng Minh Tuấn',   N'0945000005', '2025-06-01', 35000),
        (N'nv006', N'NV006', N'Võ Thị Hương',     N'0945000006', '2025-07-01', 36000),
        (N'nv007', N'NV007', N'Đặng Quốc Huy',    N'0945000007', '2025-07-15', 37000),
        (N'nv008', N'NV008', N'Bùi Thị Lan',       N'0945000008', '2025-08-01', 35500),
        (N'nv009', N'NV009', N'Phan Văn Đức',     N'0945000009', '2025-08-15', 36500),
        (N'nv010', N'NV010', N'Ngô Thị Mai',      N'0945000010', '2025-09-01', 35000),
        (N'nv011', N'NV011', N'Lý Văn Phong',     N'0945000011', '2025-09-15', 37500),
        (N'nv012', N'NV012', N'Đinh Thị Ngọc',    N'0945000012', '2025-10-01', 36000),
        (N'nv013', N'NV013', N'Mai Văn Long',      N'0945000013', '2025-10-15', 38000),
        (N'nv014', N'NV014', N'Tô Thị Hạnh',      N'0945000014', '2025-11-01', 35500)
    ) v(Username, EmpCode, FullName, Phone, StartDate, Hourly)
)
INSERT INTO dbo.Users (Username, Email, PasswordHash, Role, IsActive)
SELECT v.Username, v.Username + N'@workforce.vn', @pwd, N'Employee', 1
FROM nv v
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.Username = v.Username);

;WITH nv AS (
    SELECT * FROM (VALUES
        (N'nv005', N'NV005', N'Hoàng Minh Tuấn',   N'0945000005', '2025-06-01'),
        (N'nv006', N'NV006', N'Võ Thị Hương',     N'0945000006', '2025-07-01'),
        (N'nv007', N'NV007', N'Đặng Quốc Huy',    N'0945000007', '2025-07-15'),
        (N'nv008', N'NV008', N'Bùi Thị Lan',       N'0945000008', '2025-08-01'),
        (N'nv009', N'NV009', N'Phan Văn Đức',     N'0945000009', '2025-08-15'),
        (N'nv010', N'NV010', N'Ngô Thị Mai',      N'0945000010', '2025-09-01'),
        (N'nv011', N'NV011', N'Lý Văn Phong',     N'0945000011', '2025-09-15'),
        (N'nv012', N'NV012', N'Đinh Thị Ngọc',    N'0945000012', '2025-10-01'),
        (N'nv013', N'NV013', N'Mai Văn Long',      N'0945000013', '2025-10-15'),
        (N'nv014', N'NV014', N'Tô Thị Hạnh',      N'0945000014', '2025-11-01')
    ) v(Username, EmpCode, FullName, Phone, StartDate)
)
INSERT INTO dbo.Employees (UserId, EmployeeCode, FullName, Phone, StartDate, IsActive)
SELECT u.Id, v.EmpCode, v.FullName, v.Phone, CAST(v.StartDate AS DATE), 1
FROM nv v
INNER JOIN dbo.Users u ON u.Username = v.Username
WHERE NOT EXISTS (SELECT 1 FROM dbo.Employees e WHERE e.EmployeeCode = v.EmpCode);

-- Gán cửa hàng: 4×Q1, 3×Q7, 3×Bình Thạnh
;WITH assign AS (
    SELECT e.Id AS EmployeeId, @sQ1 AS StoreId FROM dbo.Employees e WHERE e.EmployeeCode IN (N'NV005',N'NV006',N'NV007',N'NV008') UNION ALL
    SELECT e.Id, @sQ7 FROM dbo.Employees e WHERE e.EmployeeCode IN (N'NV009',N'NV010',N'NV011') UNION ALL
    SELECT e.Id, @sBT FROM dbo.Employees e WHERE e.EmployeeCode IN (N'NV012',N'NV013',N'NV014')
)
INSERT INTO dbo.EmployeeStores (EmployeeId, StoreId)
SELECT a.EmployeeId, a.StoreId FROM assign a
WHERE NOT EXISTS (SELECT 1 FROM dbo.EmployeeStores es WHERE es.EmployeeId = a.EmployeeId AND es.StoreId = a.StoreId);

-- Lương/giờ khởi điểm
;WITH nv AS (
    SELECT * FROM (VALUES
        (N'NV005', 35000), (N'NV006', 36000), (N'NV007', 37000), (N'NV008', 35500), (N'NV009', 36500),
        (N'NV010', 35000), (N'NV011', 37500), (N'NV012', 36000), (N'NV013', 38000), (N'NV014', 35500)
    ) v(Code, Hourly)
)
INSERT INTO dbo.SalaryCoefficients (EmployeeId, BaseSalaryPerHour, Coefficient, EffectiveFrom, Note, CreatedBy)
SELECT e.Id, v.Hourly, 1.0, CAST(e.StartDate AS DATE), N'Lương giờ seed NV005–NV014', @adminId
FROM nv v
INNER JOIN dbo.Employees e ON e.EmployeeCode = v.Code
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.SalaryCoefficients sc
    WHERE sc.EmployeeId = e.Id AND sc.EffectiveFrom = CAST(e.StartDate AS DATE)
);
GO

-- ── 2. Lịch làm + chấm công (5 tháng) ────────────────────────────────────────
SET NOCOUNT ON;
DECLARE @adminId INT = (SELECT TOP 1 Id FROM dbo.Users WHERE Username = N'admin');
DECLARE @mgrId   INT = (SELECT TOP 1 Id FROM dbo.Users WHERE Username = N'manager1');

IF OBJECT_ID('tempdb..#WorkDays') IS NOT NULL DROP TABLE #WorkDays;
CREATE TABLE #WorkDays (
    WorkDate DATE NOT NULL PRIMARY KEY,
    Y INT NOT NULL,
    M INT NOT NULL
);

;WITH n AS (
    SELECT 0 AS d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
    UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14
    UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19
    UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24
    UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29
    UNION ALL SELECT 30
),
months AS (
    SELECT CAST('2025-12-01' AS DATE) AS ms UNION ALL
    SELECT '2026-01-01' UNION ALL SELECT '2026-02-01' UNION ALL SELECT '2026-03-01' UNION ALL SELECT '2026-04-01'
)
INSERT INTO #WorkDays (WorkDate, Y, M)
SELECT DATEADD(DAY, n.d, m.ms), YEAR(m.ms), MONTH(m.ms)
FROM months m
CROSS JOIN n
WHERE DATEADD(DAY, n.d, m.ms) < DATEADD(MONTH, 1, m.ms)
  AND DATEPART(WEEKDAY, DATEADD(DAY, n.d, m.ms)) NOT IN (1, 7);

IF OBJECT_ID('tempdb..#EmpStore') IS NOT NULL DROP TABLE #EmpStore;
SELECT e.Id AS EmployeeId, e.EmployeeCode, es.StoreId
INTO #EmpStore
FROM dbo.Employees e
INNER JOIN dbo.EmployeeStores es ON es.EmployeeId = e.Id
WHERE e.EmployeeCode BETWEEN N'NV005' AND N'NV014';

-- Ca làm (đăng ký + chấm công) — ~80% ngày làm / NV
INSERT INTO dbo.ShiftRegistrations (EmployeeId, ShiftId, StartTime, EndTime, StoreId, WorkDate, Status, ReviewedBy, ReviewedAt)
SELECT
    x.EmployeeId, NULL,
    x.StartTime, x.EndTime, x.StoreId, x.WorkDate,
    N'Approved', @mgrId, DATEADD(DAY, -3, CAST(x.WorkDate AS DATETIME2))
FROM (
    SELECT
        es.EmployeeId, es.StoreId, wd.WorkDate,
        CASE ABS(CHECKSUM(es.EmployeeId, wd.WorkDate)) % 3
            WHEN 0 THEN CAST('07:00' AS TIME)
            WHEN 1 THEN CAST('12:00' AS TIME)
            ELSE CAST('08:00' AS TIME)
        END AS StartTime,
        CASE ABS(CHECKSUM(es.EmployeeId, wd.WorkDate)) % 3
            WHEN 0 THEN CAST('12:00' AS TIME)
            WHEN 1 THEN CAST('17:00' AS TIME)
            ELSE CAST('17:00' AS TIME)
        END AS EndTime
    FROM #EmpStore es
    CROSS JOIN #WorkDays wd
    WHERE ABS(CHECKSUM(es.EmployeeId, wd.WorkDate, 1)) % 5 <> 0
) x
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.ShiftRegistrations r
    WHERE r.EmployeeId = x.EmployeeId AND r.StoreId = x.StoreId
      AND r.WorkDate = x.WorkDate AND r.StartTime = x.StartTime AND r.EndTime = x.EndTime
);

INSERT INTO dbo.Attendances (EmployeeId, StoreId, WorkDate, CheckIn, CheckOut, OvertimeHours, Status, CreatedBy)
SELECT
    x.EmployeeId, x.StoreId, x.WorkDate, x.CheckIn, x.CheckOut,
    CASE WHEN x.WorkedH > 8 THEN CAST(x.WorkedH - 8 AS DECIMAL(4,2)) ELSE 0 END,
    N'Worked', @adminId
FROM (
    SELECT
        r.EmployeeId, r.StoreId, r.WorkDate, r.StartTime AS CheckIn, r.EndTime AS CheckOut,
        CAST(DATEDIFF(MINUTE, r.StartTime, r.EndTime) AS DECIMAL(7,2)) / 60.0 AS WorkedH
    FROM dbo.ShiftRegistrations r
    INNER JOIN dbo.Employees e ON e.Id = r.EmployeeId
    WHERE e.EmployeeCode BETWEEN N'NV005' AND N'NV014'
      AND r.Status = N'Approved'
      AND r.WorkDate >= '2025-12-01' AND r.WorkDate < '2026-05-01'
) x
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Attendances a
    WHERE a.EmployeeId = x.EmployeeId AND a.StoreId = x.StoreId AND a.WorkDate = x.WorkDate
);

PRINT N'Đã seed đăng ký ca + chấm công NV005–NV014 (12/2025–04/2026).';
GO

-- ── 3. Bảng lương theo cửa hàng / tháng ───────────────────────────────────────
SET NOCOUNT ON;
DECLARE @adminId INT = (SELECT TOP 1 Id FROM dbo.Users WHERE Username = N'admin');

IF OBJECT_ID('tempdb..#PayMonths') IS NOT NULL DROP TABLE #PayMonths;
CREATE TABLE #PayMonths (Y INT NOT NULL, M INT NOT NULL, PStatus NVARCHAR(20) NOT NULL);
INSERT INTO #PayMonths VALUES
    (2025, 12, N'Paid'), (2026, 1, N'Paid'), (2026, 2, N'Paid'),
    (2026, 3, N'Approved'), (2026, 4, N'Approved');

DECLARE @y INT, @m INT, @st NVARCHAR(20), @storeId INT;
DECLARE @df DATE, @dt DATE, @payrollId INT;
DECLARE @otMult DECIMAL(5,2);

DECLARE store_cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT Id, OvertimeRateMultiplier FROM dbo.Stores WHERE IsActive = 1;

OPEN store_cur;
FETCH NEXT FROM store_cur INTO @storeId, @otMult;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE month_cur CURSOR LOCAL FAST_FORWARD FOR SELECT Y, M, PStatus FROM #PayMonths;
    OPEN month_cur;
    FETCH NEXT FROM month_cur INTO @y, @m, @st;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @df = DATEFROMPARTS(@y, @m, 1);
        SET @dt = EOMONTH(@df);

        IF NOT EXISTS (SELECT 1 FROM dbo.Payrolls WHERE StoreId = @storeId AND [Year] = @y AND [Month] = @m)
        BEGIN
            INSERT INTO dbo.Payrolls (StoreId, [Month], [Year], Status, TotalAmount, CreatedBy, ApprovedBy, ApprovedAt)
            VALUES (@storeId, @m, @y, @st, 0, @adminId,
                CASE WHEN @st IN (N'Approved', N'Paid') THEN @adminId ELSE NULL END,
                CASE WHEN @st IN (N'Approved', N'Paid') THEN GETUTCDATE() ELSE NULL END);
        END

        SET @payrollId = (SELECT Id FROM dbo.Payrolls WHERE StoreId = @storeId AND [Year] = @y AND [Month] = @m);

        DELETE pd FROM dbo.PayrollDetails pd WHERE pd.PayrollId = @payrollId;

        INSERT INTO dbo.PayrollDetails (
            PayrollId, EmployeeId, WorkedDays, WorkedHours, OvertimeHours,
            BaseSalaryPerHour, Coefficient, GrossSalary, Bonus, Deduction)
        SELECT
            @payrollId,
            agg.EmployeeId,
            agg.WorkedDays,
            agg.WorkedHours,
            agg.OvertimeHours,
            agg.Hourly,
            agg.Coeff,
            CAST(ROUND((agg.RegularH * agg.Hourly + agg.OvertimeHours * agg.Hourly * @otMult) * agg.Coeff, 0) AS DECIMAL(18,2)),
            0, 0
        FROM (
            SELECT
                a.EmployeeId,
                COUNT(*) AS WorkedDays,
                SUM(CAST(DATEDIFF(MINUTE, a.CheckIn, a.CheckOut) AS DECIMAL(7,2)) / 60.0) AS WorkedHours,
                SUM(a.OvertimeHours) AS OvertimeHours,
                SUM(CAST(DATEDIFF(MINUTE, a.CheckIn, a.CheckOut) AS DECIMAL(7,2)) / 60.0) - SUM(a.OvertimeHours) AS RegularH,
                COALESCE((
                    SELECT TOP 1 sc.BaseSalaryPerHour
                    FROM dbo.SalaryCoefficients sc
                    WHERE sc.EmployeeId = a.EmployeeId AND sc.EffectiveFrom <= @df
                    ORDER BY sc.EffectiveFrom DESC
                ), 0) AS Hourly,
                COALESCE((
                    SELECT TOP 1 sc.Coefficient
                    FROM dbo.SalaryCoefficients sc
                    WHERE sc.EmployeeId = a.EmployeeId AND sc.EffectiveFrom <= @df
                    ORDER BY sc.EffectiveFrom DESC
                ), 1.0) AS Coeff
            FROM dbo.Attendances a
            INNER JOIN dbo.EmployeeStores es ON es.EmployeeId = a.EmployeeId AND es.StoreId = @storeId
            WHERE a.StoreId = @storeId
              AND a.WorkDate BETWEEN @df AND @dt
              AND a.Status = N'Worked' AND a.CheckOut IS NOT NULL
            GROUP BY a.EmployeeId
        ) agg
        WHERE agg.WorkedDays > 0;

        UPDATE dbo.Payrolls
        SET TotalAmount = (SELECT COALESCE(SUM(GrossSalary + Bonus - Deduction), 0) FROM dbo.PayrollDetails WHERE PayrollId = @payrollId),
            Status = @st
        WHERE Id = @payrollId;

        FETCH NEXT FROM month_cur INTO @y, @m, @st;
    END
    CLOSE month_cur; DEALLOCATE month_cur;

    FETCH NEXT FROM store_cur INTO @storeId, @otMult;
END
CLOSE store_cur; DEALLOCATE store_cur;

PRINT N'Đã seed bảng lương 12/2025–04/2026 cho mọi cửa hàng (từ chấm công).';
PRINT N'Đăng nhập NV mới: nv005–nv014 / Employee@123';
PRINT N'Báo cáo: menu Báo cáo → chọn tháng; Bảng lương → lọc CH + tháng.';
GO
