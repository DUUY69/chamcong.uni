-- Dữ liệu mẫu: hệ số lương/giờ, chấm công tháng 5/2026 (Q1), gợi ý tính bảng lương trên app
USE WorkforceManagement;
GO
SET NOCOUNT ON;

DECLARE @adminId INT = (SELECT TOP 1 Id FROM dbo.Users WHERE Username = N'admin');
DECLARE @store1Id INT = (SELECT TOP 1 Id FROM dbo.Stores WHERE Name LIKE N'%Q1%');
IF @adminId IS NULL OR @store1Id IS NULL
BEGIN
    RAISERROR(N'Chạy 02_SeedData.sql hoặc 03_SeedData_Real.sql trước.', 16, 1);
    RETURN;
END

-- Hệ số lương theo GIỜ (VNĐ/giờ)
;WITH rates AS (
    SELECT e.Id AS EmployeeId, r.Hourly, r.Coeff
    FROM dbo.Employees e
    INNER JOIN (VALUES
        (N'NV001', 50000, 1.5),
        (N'NV002', 37500, 1.0),
        (N'NV003', 37500, 1.0),
        (N'NV004', 35000, 1.0)
    ) r(Code, Hourly, Coeff) ON r.Code = e.EmployeeCode
)
INSERT INTO dbo.SalaryCoefficients (EmployeeId, BaseSalaryPerHour, Coefficient, EffectiveFrom, Note, CreatedBy)
SELECT EmployeeId, Hourly, Coeff, '2024-01-01', N'Lương giờ mẫu', @adminId
FROM rates r
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.SalaryCoefficients sc
    WHERE sc.EmployeeId = r.EmployeeId AND sc.EffectiveFrom = '2024-01-01'
);

PRINT N'Đã cập nhật/thêm hệ số lương/giờ.';

-- Chấm công mẫu tháng 5/2026 tại Q1 (Worked, đã ra ca)
DECLARE @emp2 INT = (SELECT Id FROM dbo.Employees WHERE EmployeeCode = N'NV002');
DECLARE @emp3 INT = (SELECT Id FROM dbo.Employees WHERE EmployeeCode = N'NV003');

;WITH demo AS (
    SELECT @emp2 AS EmployeeId, CAST('2026-05-02' AS DATE) AS WorkDate, CAST('07:00' AS TIME) AS Cin, CAST('12:00' AS TIME) AS Cout, 0 AS OT UNION ALL
    SELECT @emp2, '2026-05-05', '07:00', '17:00', 2 UNION ALL
    SELECT @emp2, '2026-05-06', '07:30', '12:00', 0 UNION ALL
    SELECT @emp2, '2026-05-07', '07:00', '12:00', 0 UNION ALL
    SELECT @emp3, '2026-05-02', '12:00', '17:00', 0 UNION ALL
    SELECT @emp3, '2026-05-05', '12:00', '17:00', 0 UNION ALL
    SELECT @emp3, '2026-05-08', '07:00', '12:00', 0 UNION ALL
    SELECT @emp3, '2026-05-09', '07:00', '12:00', 0
)
INSERT INTO dbo.Attendances (EmployeeId, StoreId, WorkDate, CheckIn, CheckOut, OvertimeHours, Status, CreatedBy)
SELECT d.EmployeeId, @store1Id, d.WorkDate, d.Cin, d.Cout, d.OT, N'Worked', @adminId
FROM demo d
WHERE d.EmployeeId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM dbo.Attendances a
    WHERE a.EmployeeId = d.EmployeeId AND a.StoreId = @store1Id AND a.WorkDate = d.WorkDate
);

PRINT N'Đã thêm chấm công mẫu (nếu chưa có).';
PRINT N'Tiếp theo: trên app Bảng lương → Tính lương mới → Passion Coffee Q1 → Tháng 5/2026 → Tính lương.';
GO
