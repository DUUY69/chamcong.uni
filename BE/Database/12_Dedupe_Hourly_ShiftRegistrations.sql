/*
  WorkforceManagement — Gộp ca trùng theo KHUNG GIỜ NHỎ (1 giờ)
  Mục tiêu: cùng NV + CH + ngày + StartTime + EndTime → GIỮ 1 dòng, hủy phần trùng

  Chạy trên SSMS, database WorkforceManagement:
    1) Chạy phần PREVIEW trước (SELECT)
    2) Nếu đúng → bỏ comment BEGIN TRAN ... COMMIT và chạy UPDATE

  Không xóa cứng — set Status = 'Cancelled' (giữ lịch sử).
*/
SET NOCOUNT ON;
GO

USE WorkforceManagement;
GO

-- ========== PREVIEW: trùng khung giờ (Pending/Approved) ==========
;WITH Active AS (
    SELECT
        r.Id,
        r.EmployeeId,
        e.FullName AS EmployeeName,
        r.StoreId,
        s.Name AS StoreName,
        r.WorkDate,
        r.StartTime,
        r.EndTime,
        r.Status,
        DATEDIFF(MINUTE, r.StartTime, r.EndTime) AS DurationMin,
        ROW_NUMBER() OVER (
            PARTITION BY r.EmployeeId, r.StoreId, r.WorkDate, r.StartTime, r.EndTime
            ORDER BY
                CASE r.Status WHEN N'Approved' THEN 0 WHEN N'Pending' THEN 1 ELSE 2 END,
                r.Id
        ) AS rn
    FROM dbo.ShiftRegistrations r
    INNER JOIN dbo.Employees e ON e.Id = r.EmployeeId
    INNER JOIN dbo.Stores s ON s.Id = r.StoreId
    WHERE r.Status IN (N'Pending', N'Approved')
),
DupGroups AS (
    SELECT EmployeeId, StoreId, WorkDate, StartTime, EndTime, COUNT(*) AS Cnt
    FROM Active
    GROUP BY EmployeeId, StoreId, WorkDate, StartTime, EndTime
    HAVING COUNT(*) > 1
)
SELECT
    a.Id AS WillCancelId,
    keep.Id AS KeepId,
    a.EmployeeName,
    a.StoreName,
    a.WorkDate,
    CONVERT(varchar(5), a.StartTime, 108) + N'–' + CONVERT(varchar(5), a.EndTime, 108) AS KhungGio,
    a.Status AS StatusTrung,
    keep.Status AS StatusGiu
FROM Active a
INNER JOIN DupGroups g
    ON g.EmployeeId = a.EmployeeId AND g.StoreId = a.StoreId
   AND g.WorkDate = a.WorkDate AND g.StartTime = a.StartTime AND g.EndTime = a.EndTime
INNER JOIN Active keep
    ON keep.EmployeeId = a.EmployeeId AND keep.StoreId = a.StoreId
   AND keep.WorkDate = a.WorkDate AND keep.StartTime = a.StartTime AND keep.EndTime = a.EndTime
   AND keep.rn = 1
WHERE a.rn > 1
ORDER BY a.WorkDate, a.StoreId, a.StartTime, a.EmployeeName;

-- ========== PREVIEW: ca DÀI (>60 phút) khi đã có ca 1 giờ con ==========
;WITH Hourly AS (
    SELECT DISTINCT EmployeeId, StoreId, WorkDate, StartTime, EndTime
    FROM dbo.ShiftRegistrations
    WHERE Status IN (N'Pending', N'Approved')
      AND DATEDIFF(MINUTE, StartTime, EndTime) <= 60
),
LongReg AS (
    SELECT r.*
    FROM dbo.ShiftRegistrations r
    WHERE r.Status IN (N'Pending', N'Approved')
      AND DATEDIFF(MINUTE, r.StartTime, r.EndTime) > 60
)
SELECT
    l.Id AS WillCancelLongId,
    l.EmployeeId,
    e.FullName,
    s.Name AS StoreName,
    l.WorkDate,
    CONVERT(varchar(5), l.StartTime, 108) + N'–' + CONVERT(varchar(5), l.EndTime, 108) AS CaDai,
    l.Status,
    COUNT(h.StartTime) AS SoKhungGioCon
FROM LongReg l
INNER JOIN dbo.Employees e ON e.Id = l.EmployeeId
INNER JOIN dbo.Stores s ON s.Id = l.StoreId
INNER JOIN Hourly h
    ON h.EmployeeId = l.EmployeeId AND h.StoreId = l.StoreId AND h.WorkDate = l.WorkDate
   AND h.StartTime >= l.StartTime AND h.EndTime <= l.EndTime
GROUP BY l.Id, l.EmployeeId, e.FullName, s.Name, l.WorkDate, l.StartTime, l.EndTime, l.Status
ORDER BY l.WorkDate, l.StoreId;

GO

/*
-- ========== THỰC THI (bỏ comment khi đã xem PREVIEW OK) ==========

BEGIN TRAN;

-- A) Hủy bản trùng cùng khung giờ — giữ 1 (ưu tiên Approved, rồi Id nhỏ)
;WITH Active AS (
    SELECT
        Id,
        ROW_NUMBER() OVER (
            PARTITION BY EmployeeId, StoreId, WorkDate, StartTime, EndTime
            ORDER BY
                CASE Status WHEN N'Approved' THEN 0 WHEN N'Pending' THEN 1 ELSE 2 END,
                Id
        ) AS rn
    FROM dbo.ShiftRegistrations
    WHERE Status IN (N'Pending', N'Approved')
)
UPDATE r
SET
    Status = N'Cancelled',
    ReviewedAt = GETUTCDATE(),
    RejectReason = COALESCE(r.RejectReason, N'Dedupe hourly — giữ 1 khung')
FROM dbo.ShiftRegistrations r
INNER JOIN Active a ON a.Id = r.Id
WHERE a.rn > 1;

PRINT N'Hủy trùng khung giờ: ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' dòng';

-- B) Hủy ca dài nếu đã có đủ slice 1 giờ bên trong
;WITH Hourly AS (
    SELECT EmployeeId, StoreId, WorkDate, StartTime, EndTime
    FROM dbo.ShiftRegistrations
    WHERE Status IN (N'Pending', N'Approved')
      AND DATEDIFF(MINUTE, StartTime, EndTime) <= 60
),
LongToCancel AS (
    SELECT l.Id
    FROM dbo.ShiftRegistrations l
    WHERE l.Status IN (N'Pending', N'Approved')
      AND DATEDIFF(MINUTE, l.StartTime, l.EndTime) > 60
      AND EXISTS (
          SELECT 1 FROM Hourly h
          WHERE h.EmployeeId = l.EmployeeId AND h.StoreId = l.StoreId AND h.WorkDate = l.WorkDate
            AND h.StartTime >= l.StartTime AND h.EndTime <= l.EndTime
      )
)
UPDATE r
SET
    Status = N'Cancelled',
    ReviewedAt = GETUTCDATE(),
    RejectReason = COALESCE(r.RejectReason, N'Đã tách theo giờ — hủy ca dài')
FROM dbo.ShiftRegistrations r
INNER JOIN LongToCancel x ON x.Id = r.Id;

PRINT N'Hủy ca dài (đã có giờ con): ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' dòng';

-- COMMIT;
-- ROLLBACK;

*/

GO

-- ========== KIỂM TRA SAU ==========
SELECT
    EmployeeId, StoreId, WorkDate, StartTime, EndTime,
    COUNT(*) AS SoDong
FROM dbo.ShiftRegistrations
WHERE Status IN (N'Pending', N'Approved')
GROUP BY EmployeeId, StoreId, WorkDate, StartTime, EndTime
HAVING COUNT(*) > 1;

-- Kỳ vọng: 0 dòng
