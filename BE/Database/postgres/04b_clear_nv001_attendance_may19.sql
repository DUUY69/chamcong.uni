DELETE FROM "Attendances" a
USING "Employees" e
WHERE a."EmployeeId" = e."Id"
  AND e."EmployeeCode" = 'NV002'
  AND a."WorkDate" = DATE '2026-05-19';
