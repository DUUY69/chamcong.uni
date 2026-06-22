-- 10 NV (NV005–NV014): đăng ký ca Đã duyệt ngày 19/05/2026 (chưa chấm công — QL dùng «Nhập giờ»)
-- Chạy sau: 03 hoặc 09, 08
USE WorkforceManagement;
GO
SET NOCOUNT ON;

IF COL_LENGTH('dbo.ShiftRegistrations', 'StartTime') IS NULL
BEGIN
    RAISERROR(N'Chạy 08_ShiftRegistration_CustomTimes.sql trước.', 16, 1);
    RETURN;
END

DECLARE @mgrId INT = (SELECT TOP 1 Id FROM dbo.Users WHERE Username = N'manager1');
DECLARE @workDate DATE = '2026-05-19';

IF @mgrId IS NULL
BEGIN
    RAISERROR(N'Chạy 03_SeedData_Real.sql trước.', 16, 1);
    RETURN;
END

IF OBJECT_ID('tempdb..#ShiftPlan') IS NOT NULL DROP TABLE #ShiftPlan;
CREATE TABLE #ShiftPlan (
    EmpCode   NVARCHAR(20) NOT NULL,
    StartTime TIME NOT NULL,
    EndTime   TIME NOT NULL
);

INSERT INTO #ShiftPlan (EmpCode, StartTime, EndTime) VALUES
    (N'NV005', '07:00', '12:00'),
    (N'NV006', '12:00', '17:00'),
    (N'NV007', '08:00', '17:00'),
    (N'NV008', '07:00', '12:00'),
    (N'NV009', '12:00', '17:00'),
    (N'NV010', '08:00', '17:00'),
    (N'NV011', '07:00', '12:00'),
    (N'NV012', '12:00', '17:00'),
    (N'NV013', '08:00', '17:00'),
    (N'NV014', '07:00', '12:00');

INSERT INTO dbo.ShiftRegistrations (EmployeeId, ShiftId, StartTime, EndTime, StoreId, WorkDate, Status, ReviewedBy, ReviewedAt)
SELECT
    e.Id,
    NULL,
    sp.StartTime,
    sp.EndTime,
    es.StoreId,
    @workDate,
    N'Approved',
    @mgrId,
    GETUTCDATE()
FROM #ShiftPlan sp
INNER JOIN dbo.Employees e ON e.EmployeeCode = sp.EmpCode
INNER JOIN (
    SELECT EmployeeId, MIN(StoreId) AS StoreId
    FROM dbo.EmployeeStores
    GROUP BY EmployeeId
) es ON es.EmployeeId = e.Id
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.ShiftRegistrations r
    WHERE r.EmployeeId = e.Id
      AND r.StoreId = es.StoreId
      AND r.WorkDate = @workDate
      AND r.StartTime = sp.StartTime
      AND r.EndTime = sp.EndTime
);

PRINT N'Đã seed ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' ca duyệt 19/05/2026 (NV005–NV014).';
PRINT N'Admin/Manager: Chấm công → 19/05 → khối «Chưa chấm công» → Nhập giờ.';
GO
