-- nv001 (Trần Thị An / NV002): ca đã duyệt ngày 19/05/2026 (chấm công do QL bấm «Nhập giờ» trên app)
-- Chạy sau 03, 08
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
DECLARE @empId   INT = (SELECT TOP 1 Id FROM dbo.Employees WHERE EmployeeCode = N'NV002');
DECLARE @storeQ1 INT = (SELECT TOP 1 Id FROM dbo.Stores WHERE Name LIKE N'%Q1%');
DECLARE @workDate DATE = '2026-05-19';

IF @empId IS NULL OR @storeQ1 IS NULL
BEGIN
    RAISERROR(N'Chạy 03_SeedData_Real.sql trước (NV002 / Q1).', 16, 1);
    RETURN;
END

INSERT INTO dbo.ShiftRegistrations (EmployeeId, ShiftId, StartTime, EndTime, StoreId, WorkDate, Status, ReviewedBy, ReviewedAt)
SELECT @empId, NULL, CAST('08:00' AS TIME), CAST('17:00' AS TIME), @storeQ1, @workDate, N'Approved', @mgrId, GETUTCDATE()
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.ShiftRegistrations r
    WHERE r.EmployeeId = @empId AND r.StoreId = @storeQ1 AND r.WorkDate = @workDate
      AND r.StartTime = '08:00' AND r.EndTime = '17:00'
);

PRINT N'Đã seed ca duyệt 19/05/2026 cho nv001 (NV002). Dùng «Nhập giờ» trên app để chấm công.';
GO
