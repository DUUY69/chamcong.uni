-- NV005–NV014: ca duyệt 19/05/2026 (chưa chấm công)
INSERT INTO "ShiftRegistrations" (
    "EmployeeId", "ShiftId", "StartTime", "EndTime", "StoreId", "WorkDate",
    "Status", "ReviewedBy", "ReviewedAt"
)
SELECT
    e."Id", NULL, sp.st, sp.et, es.store_id, DATE '2026-05-19',
    'Approved', m."Id", NOW() AT TIME ZONE 'utc'
FROM (VALUES
    ('NV005', TIME '07:00', TIME '12:00'),
    ('NV006', TIME '12:00', TIME '17:00'),
    ('NV007', TIME '08:00', TIME '17:00'),
    ('NV008', TIME '07:00', TIME '12:00'),
    ('NV009', TIME '12:00', TIME '17:00'),
    ('NV010', TIME '08:00', TIME '17:00'),
    ('NV011', TIME '07:00', TIME '12:00'),
    ('NV012', TIME '12:00', TIME '17:00'),
    ('NV013', TIME '08:00', TIME '17:00'),
    ('NV014', TIME '07:00', TIME '12:00')
) AS sp(code, st, et)
JOIN "Employees" e ON e."EmployeeCode" = sp.code
JOIN (
    SELECT "EmployeeId", MIN("StoreId") AS store_id
    FROM "EmployeeStores"
    GROUP BY "EmployeeId"
) es ON es."EmployeeId" = e."Id"
CROSS JOIN "Users" m
WHERE m."Username" = 'manager1'
  AND NOT EXISTS (
    SELECT 1 FROM "ShiftRegistrations" r
    WHERE r."EmployeeId" = e."Id" AND r."StoreId" = es.store_id
      AND r."WorkDate" = DATE '2026-05-19'
      AND r."StartTime" = sp.st AND r."EndTime" = sp.et
  );
