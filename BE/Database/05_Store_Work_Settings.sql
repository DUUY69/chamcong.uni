-- Cấu hình giờ công chuẩn / hệ số OT theo cửa hàng (đọc từ DB, không hardcode trong app)
USE WorkforceManagement;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Stores') AND name = 'StandardWorkHoursPerDay')
BEGIN
    ALTER TABLE Stores ADD StandardWorkHoursPerDay DECIMAL(4,2) NOT NULL
        CONSTRAINT DF_Stores_StandardWorkHours DEFAULT (8);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Stores') AND name = 'OvertimeRateMultiplier')
BEGIN
    ALTER TABLE Stores ADD OvertimeRateMultiplier DECIMAL(4,2) NOT NULL
        CONSTRAINT DF_Stores_OvertimeRate DEFAULT (1.5);
END
GO
