-- Đổi lương cơ bản: theo NGÀY → theo GIỜ (idempotent)
-- Lưu ý: ALTER ADD và UPDATE phải tách batch (GO) — nếu không SQL báo Msg 207 BaseSalaryPerHour.
USE WorkforceManagement;
GO

-- ── SalaryCoefficients: thêm cột giờ nếu chưa có ─────────────────────────────
IF COL_LENGTH('dbo.SalaryCoefficients', 'BaseSalaryPerHour') IS NULL
BEGIN
    ALTER TABLE dbo.SalaryCoefficients ADD BaseSalaryPerHour DECIMAL(18,2) NULL;
    PRINT N'SalaryCoefficients: đã thêm cột BaseSalaryPerHour';
END
GO

-- Chuyển dữ liệu từ cột ngày → giờ, rồi xóa cột ngày
IF COL_LENGTH('dbo.SalaryCoefficients', 'BaseSalaryPerDay') IS NOT NULL
   AND COL_LENGTH('dbo.SalaryCoefficients', 'BaseSalaryPerHour') IS NOT NULL
BEGIN
    UPDATE sc
    SET BaseSalaryPerHour = ROUND(sc.BaseSalaryPerDay / NULLIF(COALESCE(st.StandardWorkHoursPerDay, 8), 0), 0)
    FROM dbo.SalaryCoefficients sc
    OUTER APPLY (
        SELECT TOP 1 s.StandardWorkHoursPerDay
        FROM dbo.EmployeeStores es
        INNER JOIN dbo.Stores s ON s.Id = es.StoreId
        WHERE es.EmployeeId = sc.EmployeeId
        ORDER BY es.Id
    ) st
    WHERE sc.BaseSalaryPerHour IS NULL OR sc.BaseSalaryPerHour = 0;

    UPDATE dbo.SalaryCoefficients SET BaseSalaryPerHour = 0 WHERE BaseSalaryPerHour IS NULL;

    ALTER TABLE dbo.SalaryCoefficients ALTER COLUMN BaseSalaryPerHour DECIMAL(18,2) NOT NULL;
    ALTER TABLE dbo.SalaryCoefficients DROP COLUMN BaseSalaryPerDay;
    PRINT N'SalaryCoefficients: BaseSalaryPerDay → BaseSalaryPerHour';
END
ELSE IF COL_LENGTH('dbo.SalaryCoefficients', 'BaseSalaryPerHour') IS NOT NULL
    PRINT N'SalaryCoefficients: đã dùng BaseSalaryPerHour (không cần migrate).';
GO

-- ── PayrollDetails: thêm cột giờ nếu chưa có ───────────────────────────────
IF COL_LENGTH('dbo.PayrollDetails', 'BaseSalaryPerHour') IS NULL
BEGIN
    ALTER TABLE dbo.PayrollDetails ADD BaseSalaryPerHour DECIMAL(18,2) NULL;
    PRINT N'PayrollDetails: đã thêm cột BaseSalaryPerHour';
END
GO

IF COL_LENGTH('dbo.PayrollDetails', 'BaseSalaryPerDay') IS NOT NULL
   AND COL_LENGTH('dbo.PayrollDetails', 'BaseSalaryPerHour') IS NOT NULL
BEGIN
    UPDATE dbo.PayrollDetails
    SET BaseSalaryPerHour = ROUND(BaseSalaryPerDay / 8.0, 0)
    WHERE BaseSalaryPerHour IS NULL OR BaseSalaryPerHour = 0;

    UPDATE dbo.PayrollDetails SET BaseSalaryPerHour = 0 WHERE BaseSalaryPerHour IS NULL;

    ALTER TABLE dbo.PayrollDetails ALTER COLUMN BaseSalaryPerHour DECIMAL(18,2) NOT NULL;
    ALTER TABLE dbo.PayrollDetails DROP COLUMN BaseSalaryPerDay;
    PRINT N'PayrollDetails: BaseSalaryPerDay → BaseSalaryPerHour';
END
ELSE IF COL_LENGTH('dbo.PayrollDetails', 'BaseSalaryPerHour') IS NOT NULL
    PRINT N'PayrollDetails: đã dùng BaseSalaryPerHour (không cần migrate).';
GO
