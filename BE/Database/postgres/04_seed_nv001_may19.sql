-- nv001 (NV002): ca duyệt 19/05/2026
INSERT INTO "ShiftRegistrations" (
    "EmployeeId", "ShiftId", "StartTime", "EndTime", "StoreId", "WorkDate",
    "Status", "ReviewedBy", "ReviewedAt"
)
SELECT
    e."Id", NULL, TIME '08:00', TIME '17:00', s."Id", DATE '2026-05-19',
    'Approved', m."Id", NOW() AT TIME ZONE 'utc'
FROM "Employees" e
CROSS JOIN "Stores" s
CROSS JOIN "Users" m
WHERE e."EmployeeCode" = 'NV002'
  AND s."Name" LIKE '%Q1%'
  AND m."Username" = 'manager1'
  AND NOT EXISTS (
    SELECT 1 FROM "ShiftRegistrations" r
    WHERE r."EmployeeId" = e."Id" AND r."StoreId" = s."Id"
      AND r."WorkDate" = DATE '2026-05-19'
      AND r."StartTime" = TIME '08:00' AND r."EndTime" = TIME '17:00'
  );
