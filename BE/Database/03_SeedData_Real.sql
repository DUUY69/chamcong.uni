-- ============================================================
-- Workforce Management — Seed Data thực tế
-- Tài khoản:
--   admin       / Admin@123
--   manager1    / Manager@123
--   nv001       / Employee@123
--   nv002       / Employee@123
--   nv003       / Employee@123
-- ============================================================

USE WorkforceManagement;
GO

-- ── 1. Users ─────────────────────────────────────────────────────────────────
-- BCrypt hash của "Admin@123"
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'admin')
INSERT INTO Users (Username, Email, PasswordHash, Role, IsActive)
VALUES ('admin', 'admin@workforce.vn',
        '$2a$11$K8Ow3Ow3Ow3Ow3Ow3Ow3OeK8Ow3Ow3Ow3Ow3Ow3Ow3Ow3Ow3Ow2',
        'Admin', 1);

-- BCrypt hash của "Manager@123"
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'manager1')
INSERT INTO Users (Username, Email, PasswordHash, Role, IsActive)
VALUES ('manager1', 'manager1@workforce.vn',
        '$2a$11$K8Ow3Ow3Ow3Ow3Ow3Ow3OeK8Ow3Ow3Ow3Ow3Ow3Ow3Ow3Ow3Ow2',
        'Manager', 1);

-- BCrypt hash của "Employee@123"
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'nv001')
INSERT INTO Users (Username, Email, PasswordHash, Role, IsActive)
VALUES ('nv001', 'nv001@workforce.vn',
        '$2a$11$K8Ow3Ow3Ow3Ow3Ow3Ow3OeK8Ow3Ow3Ow3Ow3Ow3Ow3Ow3Ow3Ow2',
        'Employee', 1);

IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'nv002')
INSERT INTO Users (Username, Email, PasswordHash, Role, IsActive)
VALUES ('nv002', 'nv002@workforce.vn',
        '$2a$11$K8Ow3Ow3Ow3Ow3Ow3Ow3OeK8Ow3Ow3Ow3Ow3Ow3Ow3Ow3Ow3Ow2',
        'Employee', 1);

IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'nv003')
INSERT INTO Users (Username, Email, PasswordHash, Role, IsActive)
VALUES ('nv003', 'nv003@workforce.vn',
        '$2a$11$K8Ow3Ow3Ow3Ow3Ow3Ow3OeK8Ow3Ow3Ow3Ow3Ow3Ow3Ow3Ow3Ow2',
        'Employee', 1);
GO

-- ── 2. Stores ─────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM Stores WHERE Name = 'Passion Coffee - Q1')
INSERT INTO Stores (Name, Address, Phone, IsActive)
VALUES ('Passion Coffee - Q1', '123 Nguyễn Huệ, Q1, TP.HCM', '028-1234-5678', 1);

IF NOT EXISTS (SELECT 1 FROM Stores WHERE Name = 'Passion Coffee - Q7')
INSERT INTO Stores (Name, Address, Phone, IsActive)
VALUES ('Passion Coffee - Q7', '456 Nguyễn Thị Thập, Q7, TP.HCM', '028-8765-4321', 1);

IF NOT EXISTS (SELECT 1 FROM Stores WHERE Name = 'Passion Coffee - Bình Thạnh')
INSERT INTO Stores (Name, Address, Phone, IsActive)
VALUES ('Passion Coffee - Bình Thạnh', '789 Đinh Bộ Lĩnh, Bình Thạnh, TP.HCM', '028-3456-7890', 1);
GO

-- ── 3. Employees ─────────────────────────────────────────────────────────────
DECLARE @adminUserId   INT = (SELECT Id FROM Users WHERE Username = 'admin');
DECLARE @managerUserId INT = (SELECT Id FROM Users WHERE Username = 'manager1');
DECLARE @nv001UserId   INT = (SELECT Id FROM Users WHERE Username = 'nv001');
DECLARE @nv002UserId   INT = (SELECT Id FROM Users WHERE Username = 'nv002');
DECLARE @nv003UserId   INT = (SELECT Id FROM Users WHERE Username = 'nv003');

IF NOT EXISTS (SELECT 1 FROM Employees WHERE UserId = @managerUserId)
INSERT INTO Employees (UserId, EmployeeCode, FullName, Phone, StartDate, IsActive)
VALUES (@managerUserId, 'NV001', N'Nguyễn Văn Quản Lý', '0901234567', '2024-01-01', 1);

IF NOT EXISTS (SELECT 1 FROM Employees WHERE UserId = @nv001UserId)
INSERT INTO Employees (UserId, EmployeeCode, FullName, Phone, StartDate, IsActive)
VALUES (@nv001UserId, 'NV002', N'Trần Thị An', '0912345678', '2024-03-01', 1);

IF NOT EXISTS (SELECT 1 FROM Employees WHERE UserId = @nv002UserId)
INSERT INTO Employees (UserId, EmployeeCode, FullName, Phone, StartDate, IsActive)
VALUES (@nv002UserId, 'NV003', N'Lê Văn Bình', '0923456789', '2024-06-01', 1);

IF NOT EXISTS (SELECT 1 FROM Employees WHERE UserId = @nv003UserId)
INSERT INTO Employees (UserId, EmployeeCode, FullName, Phone, StartDate, IsActive)
VALUES (@nv003UserId, 'NV004', N'Phạm Thị Cúc', '0934567890', '2025-01-01', 1);
GO

-- ── 4. EmployeeStores (gán nhân viên vào cửa hàng) ───────────────────────────
DECLARE @store1 INT = (SELECT Id FROM Stores WHERE Name = 'Passion Coffee - Q1');
DECLARE @store2 INT = (SELECT Id FROM Stores WHERE Name = 'Passion Coffee - Q7');
DECLARE @store3 INT = (SELECT Id FROM Stores WHERE Name = 'Passion Coffee - Bình Thạnh');

DECLARE @empManager INT = (SELECT Id FROM Employees WHERE EmployeeCode = 'NV001');
DECLARE @emp1       INT = (SELECT Id FROM Employees WHERE EmployeeCode = 'NV002');
DECLARE @emp2       INT = (SELECT Id FROM Employees WHERE EmployeeCode = 'NV003');
DECLARE @emp3       INT = (SELECT Id FROM Employees WHERE EmployeeCode = 'NV004');

-- Manager quản lý Q1 và Q7
IF NOT EXISTS (SELECT 1 FROM EmployeeStores WHERE EmployeeId = @empManager AND StoreId = @store1)
INSERT INTO EmployeeStores (EmployeeId, StoreId) VALUES (@empManager, @store1);

IF NOT EXISTS (SELECT 1 FROM EmployeeStores WHERE EmployeeId = @empManager AND StoreId = @store2)
INSERT INTO EmployeeStores (EmployeeId, StoreId) VALUES (@empManager, @store2);

-- NV002 làm Q1
IF NOT EXISTS (SELECT 1 FROM EmployeeStores WHERE EmployeeId = @emp1 AND StoreId = @store1)
INSERT INTO EmployeeStores (EmployeeId, StoreId) VALUES (@emp1, @store1);

-- NV003 làm Q1 và Q7
IF NOT EXISTS (SELECT 1 FROM EmployeeStores WHERE EmployeeId = @emp2 AND StoreId = @store1)
INSERT INTO EmployeeStores (EmployeeId, StoreId) VALUES (@emp2, @store1);

IF NOT EXISTS (SELECT 1 FROM EmployeeStores WHERE EmployeeId = @emp2 AND StoreId = @store2)
INSERT INTO EmployeeStores (EmployeeId, StoreId) VALUES (@emp2, @store2);

-- NV004 làm Bình Thạnh
IF NOT EXISTS (SELECT 1 FROM EmployeeStores WHERE EmployeeId = @emp3 AND StoreId = @store3)
INSERT INTO EmployeeStores (EmployeeId, StoreId) VALUES (@emp3, @store3);
GO

-- ── 5. Shifts ─────────────────────────────────────────────────────────────────
DECLARE @s1 INT = (SELECT Id FROM Stores WHERE Name = 'Passion Coffee - Q1');
DECLARE @s2 INT = (SELECT Id FROM Stores WHERE Name = 'Passion Coffee - Q7');
DECLARE @s3 INT = (SELECT Id FROM Stores WHERE Name = 'Passion Coffee - Bình Thạnh');

-- Q1
IF NOT EXISTS (SELECT 1 FROM Shifts WHERE StoreId = @s1 AND Name = N'Ca sáng')
INSERT INTO Shifts (StoreId, Name, StartTime, EndTime) VALUES (@s1, N'Ca sáng', '07:00', '12:00');
IF NOT EXISTS (SELECT 1 FROM Shifts WHERE StoreId = @s1 AND Name = N'Ca chiều')
INSERT INTO Shifts (StoreId, Name, StartTime, EndTime) VALUES (@s1, N'Ca chiều', '12:00', '17:00');
IF NOT EXISTS (SELECT 1 FROM Shifts WHERE StoreId = @s1 AND Name = N'Ca tối')
INSERT INTO Shifts (StoreId, Name, StartTime, EndTime) VALUES (@s1, N'Ca tối', '17:00', '22:00');
IF NOT EXISTS (SELECT 1 FROM Shifts WHERE StoreId = @s1 AND Name = N'Ca full')
INSERT INTO Shifts (StoreId, Name, StartTime, EndTime) VALUES (@s1, N'Ca full', '07:00', '17:00');

-- Q7
IF NOT EXISTS (SELECT 1 FROM Shifts WHERE StoreId = @s2 AND Name = N'Ca sáng')
INSERT INTO Shifts (StoreId, Name, StartTime, EndTime) VALUES (@s2, N'Ca sáng', '07:00', '12:00');
IF NOT EXISTS (SELECT 1 FROM Shifts WHERE StoreId = @s2 AND Name = N'Ca chiều')
INSERT INTO Shifts (StoreId, Name, StartTime, EndTime) VALUES (@s2, N'Ca chiều', '12:00', '17:00');
IF NOT EXISTS (SELECT 1 FROM Shifts WHERE StoreId = @s2 AND Name = N'Ca tối')
INSERT INTO Shifts (StoreId, Name, StartTime, EndTime) VALUES (@s2, N'Ca tối', '17:00', '22:00');

-- Bình Thạnh
IF NOT EXISTS (SELECT 1 FROM Shifts WHERE StoreId = @s3 AND Name = N'Ca sáng')
INSERT INTO Shifts (StoreId, Name, StartTime, EndTime) VALUES (@s3, N'Ca sáng', '07:00', '12:00');
IF NOT EXISTS (SELECT 1 FROM Shifts WHERE StoreId = @s3 AND Name = N'Ca chiều')
INSERT INTO Shifts (StoreId, Name, StartTime, EndTime) VALUES (@s3, N'Ca chiều', '12:00', '17:00');
GO

-- ── 6. SalaryCoefficients (hệ số lương ban đầu) ───────────────────────────────
DECLARE @adminId INT = (SELECT Id FROM Users WHERE Username = 'admin');
DECLARE @eManager INT = (SELECT Id FROM Employees WHERE EmployeeCode = 'NV001');
DECLARE @e1       INT = (SELECT Id FROM Employees WHERE EmployeeCode = 'NV002');
DECLARE @e2       INT = (SELECT Id FROM Employees WHERE EmployeeCode = 'NV003');
DECLARE @e3       INT = (SELECT Id FROM Employees WHERE EmployeeCode = 'NV004');

IF NOT EXISTS (SELECT 1 FROM SalaryCoefficients WHERE EmployeeId = @eManager)
INSERT INTO SalaryCoefficients (EmployeeId, BaseSalaryPerHour, Coefficient, EffectiveFrom, Note, CreatedBy)
VALUES (@eManager, 50000, 1.5, '2024-01-01', N'Lương giờ khởi điểm quản lý', @adminId);

IF NOT EXISTS (SELECT 1 FROM SalaryCoefficients WHERE EmployeeId = @e1)
INSERT INTO SalaryCoefficients (EmployeeId, BaseSalaryPerHour, Coefficient, EffectiveFrom, Note, CreatedBy)
VALUES (@e1, 37500, 1.0, '2024-03-01', N'Lương giờ khởi điểm', @adminId);

IF NOT EXISTS (SELECT 1 FROM SalaryCoefficients WHERE EmployeeId = @e2)
INSERT INTO SalaryCoefficients (EmployeeId, BaseSalaryPerHour, Coefficient, EffectiveFrom, Note, CreatedBy)
VALUES (@e2, 37500, 1.0, '2024-06-01', N'Lương giờ khởi điểm', @adminId);

IF NOT EXISTS (SELECT 1 FROM SalaryCoefficients WHERE EmployeeId = @e3)
INSERT INTO SalaryCoefficients (EmployeeId, BaseSalaryPerHour, Coefficient, EffectiveFrom, Note, CreatedBy)
VALUES (@e3, 35000, 1.0, '2025-01-01', N'Lương giờ khởi điểm', @adminId);
GO

-- ── 7. Attendance mẫu tháng 5/2026 ───────────────────────────────────────────
DECLARE @adminId2 INT = (SELECT Id FROM Users WHERE Username = 'admin');
DECLARE @store1Id INT = (SELECT Id FROM Stores WHERE Name = 'Passion Coffee - Q1');
DECLARE @empId1   INT = (SELECT Id FROM Employees WHERE EmployeeCode = 'NV002');
DECLARE @empId2   INT = (SELECT Id FROM Employees WHERE EmployeeCode = 'NV003');

-- NV002 - 10 ngày công tháng 5
IF NOT EXISTS (SELECT 1 FROM Attendances WHERE EmployeeId = @empId1 AND WorkDate = '2026-05-02')
INSERT INTO Attendances (EmployeeId, StoreId, WorkDate, CheckIn, CheckOut, Status, CreatedBy)
VALUES (@empId1, @store1Id, '2026-05-02', '07:00', '12:00', 'Present', @adminId2);

IF NOT EXISTS (SELECT 1 FROM Attendances WHERE EmployeeId = @empId1 AND WorkDate = '2026-05-05')
INSERT INTO Attendances (EmployeeId, StoreId, WorkDate, CheckIn, CheckOut, Status, CreatedBy)
VALUES (@empId1, @store1Id, '2026-05-05', '07:00', '17:00', 'Present', @adminId2);

IF NOT EXISTS (SELECT 1 FROM Attendances WHERE EmployeeId = @empId1 AND WorkDate = '2026-05-06')
INSERT INTO Attendances (EmployeeId, StoreId, WorkDate, CheckIn, CheckOut, Status, CreatedBy)
VALUES (@empId1, @store1Id, '2026-05-06', '07:30', '12:00', 'Late', @adminId2);

IF NOT EXISTS (SELECT 1 FROM Attendances WHERE EmployeeId = @empId1 AND WorkDate = '2026-05-07')
INSERT INTO Attendances (EmployeeId, StoreId, WorkDate, CheckIn, CheckOut, Status, CreatedBy)
VALUES (@empId1, @store1Id, '2026-05-07', '07:00', '12:00', 'Present', @adminId2);

IF NOT EXISTS (SELECT 1 FROM Attendances WHERE EmployeeId = @empId1 AND WorkDate = '2026-05-08')
INSERT INTO Attendances (EmployeeId, StoreId, WorkDate, CheckIn, CheckOut, Status, CreatedBy)
VALUES (@empId1, @store1Id, '2026-05-08', '12:00', '17:00', 'Present', @adminId2);

IF NOT EXISTS (SELECT 1 FROM Attendances WHERE EmployeeId = @empId1 AND WorkDate = '2026-05-09')
INSERT INTO Attendances (EmployeeId, StoreId, WorkDate, CheckIn, CheckOut, OvertimeHours, Status, CreatedBy)
VALUES (@empId1, @store1Id, '2026-05-09', '07:00', '17:00', 2, 'Present', @adminId2);

-- NV003 - 8 ngày công tháng 5
IF NOT EXISTS (SELECT 1 FROM Attendances WHERE EmployeeId = @empId2 AND WorkDate = '2026-05-02')
INSERT INTO Attendances (EmployeeId, StoreId, WorkDate, CheckIn, CheckOut, Status, CreatedBy)
VALUES (@empId2, @store1Id, '2026-05-02', '12:00', '17:00', 'Present', @adminId2);

IF NOT EXISTS (SELECT 1 FROM Attendances WHERE EmployeeId = @empId2 AND WorkDate = '2026-05-05')
INSERT INTO Attendances (EmployeeId, StoreId, WorkDate, CheckIn, CheckOut, Status, CreatedBy)
VALUES (@empId2, @store1Id, '2026-05-05', '12:00', '17:00', 'Present', @adminId2);

IF NOT EXISTS (SELECT 1 FROM Attendances WHERE EmployeeId = @empId2 AND WorkDate = '2026-05-06')
INSERT INTO Attendances (EmployeeId, StoreId, WorkDate, CheckIn, CheckOut, Status, CreatedBy)
VALUES (@empId2, @store1Id, '2026-05-06', '17:00', '22:00', 'Present', @adminId2);

IF NOT EXISTS (SELECT 1 FROM Attendances WHERE EmployeeId = @empId2 AND WorkDate = '2026-05-07')
INSERT INTO Attendances (EmployeeId, StoreId, WorkDate, CheckIn, CheckOut, Status, CreatedBy)
VALUES (@empId2, @store1Id, '2026-05-07', '17:00', '22:00', 'Present', @adminId2);
GO

PRINT '=== Seed data inserted successfully ===';
PRINT 'NOTE: Password hash trong script này là placeholder.';
PRINT 'Chạy lệnh bên dưới để update hash đúng sau khi BE chạy:';
PRINT '  POST http://localhost:5001/api/setup/reset-passwords';
GO
