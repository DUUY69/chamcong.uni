-- Cập nhật STK ngân hàng demo (SQL Server — local legacy)
USE WorkforceManagement;
GO

UPDATE e SET
    e.BankName = v.bank,
    e.BankAccountNo = v.stk,
    e.BankAccountName = v.holder,
    e.UpdatedAt = GETUTCDATE()
FROM dbo.Employees e
INNER JOIN (VALUES
    (N'NV001', N'Vietcombank',  N'0123456789012', N'NGUYEN VAN QUAN LY'),
    (N'NV002', N'Techcombank',  N'1903658741001', N'TRAN THI AN'),
    (N'NV003', N'Vietcombank',  N'0123456789013', N'LE VAN BINH'),
    (N'NV004', N'MB Bank',      N'0901234567890', N'PHAM THI CUC'),
    (N'NV005', N'VietinBank',   N'2012345678901', N'HOANG MINH TUAN'),
    (N'NV006', N'ACB',          N'1234567890123', N'VO THI HUONG'),
    (N'NV007', N'BIDV',         N'8801234567890', N'DANG QUOC HUY'),
    (N'NV008', N'Sacombank',    N'0401234567890', N'BUI THI LAN'),
    (N'NV009', N'Techcombank',  N'1903658741002', N'PHAN VAN DUC'),
    (N'NV010', N'VPBank',       N'0123456789014', N'NGO THI MAI'),
    (N'NV011', N'Vietcombank',  N'0123456789015', N'LY VAN PHONG'),
    (N'NV012', N'MB Bank',      N'0901234567891', N'DINH THI NGOC'),
    (N'NV013', N'VietinBank',   N'2012345678902', N'MAI VAN LONG'),
    (N'NV014', N'ACB',          N'1234567890124', N'TO THI HANH')
) AS v(code, bank, stk, holder) ON e.EmployeeCode = v.code;
GO
