-- Đồng bộ schema + trạng thái chấm công: Worked | Absent
-- Chạy trên DB: WorkforceManagement
USE WorkforceManagement;
GO

SET NOCOUNT ON;

-- Bước 1: Gỡ constraint cũ để sửa được dữ liệu
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Attendance_Status')
    ALTER TABLE dbo.Attendances DROP CONSTRAINT CK_Attendance_Status;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Attendance_Time')
    ALTER TABLE dbo.Attendances DROP CONSTRAINT CK_Attendance_Time;
GO

-- Bước 2: Cho phép CheckOut NULL (đang trong ca)
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Attendances') AND name = 'CheckOut' AND is_nullable = 0)
BEGIN
    ALTER TABLE dbo.Attendances ALTER COLUMN CheckOut TIME NULL;
    PRINT N'Đã cho phép CheckOut NULL.';
END
GO

-- Bước 3: Chuẩn hóa Status cũ (Present/Late → Worked) — bắt buộc trước khi thêm constraint mới
DECLARE @legacy INT = (
    SELECT COUNT(*) FROM dbo.Attendances
    WHERE Status IN (N'Present', N'Late')
       OR Status NOT IN (N'Worked', N'Absent')
);

IF @legacy > 0
BEGIN
    PRINT N'Sẽ cập nhật ' + CAST(@legacy AS NVARCHAR(10)) + N' bản ghi Status cũ → Worked (trừ Absent).';

    UPDATE dbo.Attendances
    SET Status = N'Worked'
    WHERE Status IN (N'Present', N'Late');

    -- Trạng thái lạ khác (không phải Worked/Absent): đổi Worked; xem lại thủ công nếu cần
    UPDATE dbo.Attendances
    SET Status = N'Worked'
    WHERE Status NOT IN (N'Worked', N'Absent');
END
ELSE
    PRINT N'Không có Status Present/Late cần chuyển.';
GO

-- Kiểm tra còn dòng vi phạm không
IF EXISTS (SELECT 1 FROM dbo.Attendances WHERE Status NOT IN (N'Worked', N'Absent'))
BEGIN
    RAISERROR(N'Còn bản ghi Attendances.Status không hợp lệ. Sửa thủ công rồi chạy lại script.', 16, 1);
    RETURN;
END
GO

-- Bước 4: Constraint giờ vào/ra
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Attendance_Time')
BEGIN
    ALTER TABLE dbo.Attendances ADD CONSTRAINT CK_Attendance_Time CHECK (
        Status = N'Absent'
        OR (CheckOut IS NOT NULL AND CheckOut > CheckIn)
        OR (CheckOut IS NULL AND Status = N'Worked')
    );
    PRINT N'Đã tạo CK_Attendance_Time.';
END
GO

-- Bước 5: Constraint trạng thái (chỉ Worked | Absent)
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Attendance_Status')
BEGIN
    ALTER TABLE dbo.Attendances ADD CONSTRAINT CK_Attendance_Status
        CHECK (Status IN (N'Worked', N'Absent'));
    PRINT N'Đã tạo CK_Attendance_Status.';
END
GO

PRINT N'Hoàn tất 04_Align_Attendance_Status.sql';
GO
