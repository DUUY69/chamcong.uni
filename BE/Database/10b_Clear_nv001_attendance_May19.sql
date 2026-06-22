-- Xóa chấm công 19/05/2026 NV002 để thử lại thao tác «Nhập giờ» / «Không đi làm»
USE WorkforceManagement;
GO

DECLARE @empId INT = (SELECT TOP 1 Id FROM dbo.Employees WHERE EmployeeCode = N'NV002');

DELETE FROM dbo.Attendances
WHERE EmployeeId = @empId AND WorkDate = '2026-05-19';

PRINT N'Đã xóa chấm công 19/05/2026 (NV002). Ca đăng ký vẫn giữ — mục Chấm công sẽ hiện «Chưa chấm công».';
GO
