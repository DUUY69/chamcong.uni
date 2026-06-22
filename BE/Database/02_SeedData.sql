-- ============================================================
-- Workforce Management — Seed Data
-- Admin: admin / Admin@123
-- Manager: manager1 / Manager@123
-- Employee: nv001 / Employee@123
-- ============================================================

USE WorkforceManagement;
GO

-- Admin user (BCrypt hash của "Admin@123")
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'admin')
INSERT INTO Users (Username, Email, PasswordHash, Role)
VALUES ('admin', 'admin@workforce.vn',
        '$2a$11$rBnqBzYvHzQwXkLmN8pOuOqKjVtWsYxZaAbBcCdDeEfFgGhHiIjJ',
        'Admin');
GO

-- Store mẫu
IF NOT EXISTS (SELECT 1 FROM Stores WHERE Name = 'Passion Coffee - Q1')
INSERT INTO Stores (Name, Address, Phone)
VALUES ('Passion Coffee - Q1', '123 Nguyễn Huệ, Q1, TP.HCM', '028-1234-5678');
GO

IF NOT EXISTS (SELECT 1 FROM Stores WHERE Name = 'Passion Coffee - Q7')
INSERT INTO Stores (Name, Address, Phone)
VALUES ('Passion Coffee - Q7', '456 Nguyễn Thị Thập, Q7, TP.HCM', '028-8765-4321');
GO

-- Shifts mẫu cho Store 1
DECLARE @storeId1 INT = (SELECT TOP 1 Id FROM Stores WHERE Name = 'Passion Coffee - Q1');

IF NOT EXISTS (SELECT 1 FROM Shifts WHERE StoreId = @storeId1 AND Name = 'Ca sáng')
INSERT INTO Shifts (StoreId, Name, StartTime, EndTime)
VALUES (@storeId1, 'Ca sáng', '07:00', '12:00');

IF NOT EXISTS (SELECT 1 FROM Shifts WHERE StoreId = @storeId1 AND Name = 'Ca chiều')
INSERT INTO Shifts (StoreId, Name, StartTime, EndTime)
VALUES (@storeId1, 'Ca chiều', '12:00', '17:00');

IF NOT EXISTS (SELECT 1 FROM Shifts WHERE StoreId = @storeId1 AND Name = 'Ca tối')
INSERT INTO Shifts (StoreId, Name, StartTime, EndTime)
VALUES (@storeId1, 'Ca tối', '17:00', '22:00');

IF NOT EXISTS (SELECT 1 FROM Shifts WHERE StoreId = @storeId1 AND Name = 'Ca full')
INSERT INTO Shifts (StoreId, Name, StartTime, EndTime)
VALUES (@storeId1, 'Ca full', '07:00', '17:00');
GO

PRINT 'Seed data inserted.';
PRINT 'NOTE: Cần cập nhật PasswordHash bằng BCrypt thực tế trước khi dùng.';
PRINT 'Chạy BE một lần để tạo admin qua API POST /api/auth/setup hoặc tự hash.';
