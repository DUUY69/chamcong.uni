-- Đăng ký ca: NV chọn giờ từ–đến (không bắt buộc chọn Shift có sẵn)
-- Chạy sau 01_Schema (và seed nếu có).

IF COL_LENGTH('ShiftRegistrations', 'StartTime') IS NULL
BEGIN
    ALTER TABLE ShiftRegistrations ADD StartTime TIME NULL;
    ALTER TABLE ShiftRegistrations ADD EndTime TIME NULL;
END
GO

UPDATE sr
SET sr.StartTime = s.StartTime, sr.EndTime = s.EndTime
FROM ShiftRegistrations sr
INNER JOIN Shifts s ON s.Id = sr.ShiftId
WHERE sr.StartTime IS NULL;
GO

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_ShiftRegistrations')
    ALTER TABLE ShiftRegistrations DROP CONSTRAINT UQ_ShiftRegistrations;
GO

DECLARE @fk NVARCHAR(256);
SELECT @fk = fk.name
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
WHERE fk.parent_object_id = OBJECT_ID('ShiftRegistrations')
  AND COL_NAME(fkc.parent_object_id, fkc.parent_column_id) = 'ShiftId';

IF @fk IS NOT NULL
    EXEC('ALTER TABLE ShiftRegistrations DROP CONSTRAINT [' + @fk + ']');
GO

ALTER TABLE ShiftRegistrations ALTER COLUMN ShiftId INT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID('ShiftRegistrations')
      AND name = 'FK_ShiftRegistrations_Shifts'
)
    ALTER TABLE ShiftRegistrations
        ADD CONSTRAINT FK_ShiftRegistrations_Shifts
        FOREIGN KEY (ShiftId) REFERENCES Shifts(Id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ShiftRegistrations_Time')
    ALTER TABLE ShiftRegistrations
        ADD CONSTRAINT CK_ShiftRegistrations_Time
        CHECK (StartTime IS NULL OR EndTime IS NULL OR EndTime > StartTime);
GO

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_ShiftReg_StoreDateTime')
    ALTER TABLE ShiftRegistrations
        ADD CONSTRAINT UQ_ShiftReg_StoreDateTime
        UNIQUE (EmployeeId, StoreId, WorkDate, StartTime, EndTime);
GO
