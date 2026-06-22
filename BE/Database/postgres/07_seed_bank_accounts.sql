-- Cập nhật STK ngân hàng demo cho nhân viên (chạy sau 02_seed / 03_seed)
-- PostgreSQL — chạy: psql -U workforce -d workforce -f 07_seed_bank_accounts.sql

UPDATE "Employees" AS e SET
    "BankName" = v.bank,
    "BankAccountNo" = v.stk,
    "BankAccountName" = v.holder,
    "UpdatedAt" = NOW() AT TIME ZONE 'utc'
FROM (VALUES
    ('NV001', 'Vietcombank',  '0123456789012', 'NGUYEN VAN QUAN LY'),
    ('NV002', 'Techcombank',  '1903658741001', 'TRAN THI AN'),
    ('NV003', 'Vietcombank',  '0123456789013', 'LE VAN BINH'),
    ('NV004', 'MB Bank',      '0901234567890', 'PHAM THI CUC'),
    ('NV005', 'VietinBank',   '2012345678901', 'HOANG MINH TUAN'),
    ('NV006', 'ACB',          '1234567890123', 'VO THI HUONG'),
    ('NV007', 'BIDV',         '8801234567890', 'DANG QUOC HUY'),
    ('NV008', 'Sacombank',    '0401234567890', 'BUI THI LAN'),
    ('NV009', 'Techcombank',  '1903658741002', 'PHAN VAN DUC'),
    ('NV010', 'VPBank',       '0123456789014', 'NGO THI MAI'),
    ('NV011', 'Vietcombank',  '0123456789015', 'LY VAN PHONG'),
    ('NV012', 'MB Bank',      '0901234567891', 'DINH THI NGOC'),
    ('NV013', 'VietinBank',   '2012345678902', 'MAI VAN LONG'),
    ('NV014', 'ACB',          '1234567890124', 'TO THI HANH')
) AS v(code, bank, stk, holder)
WHERE e."EmployeeCode" = v.code;
