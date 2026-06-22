-- Workforce Management — PostgreSQL schema
-- Chạy: psql -U workforce -d workforce -f 01_schema.sql

CREATE TABLE IF NOT EXISTS "Users" (
    "Id"           SERIAL PRIMARY KEY,
    "Username"     VARCHAR(100) NOT NULL UNIQUE,
    "Email"        VARCHAR(200) NOT NULL UNIQUE,
    "PasswordHash" VARCHAR(500) NOT NULL,
    "Role"         VARCHAR(20)  NOT NULL DEFAULT 'Employee'
        CHECK ("Role" IN ('Admin','Manager','Employee')),
    "IsActive"     BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt"    TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    "UpdatedAt"    TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS "Employees" (
    "Id"               SERIAL PRIMARY KEY,
    "UserId"           INT NOT NULL UNIQUE REFERENCES "Users"("Id"),
    "EmployeeCode"     VARCHAR(20)  NOT NULL UNIQUE,
    "FullName"         VARCHAR(200) NOT NULL,
    "DateOfBirth"      DATE NULL,
    "Gender"           VARCHAR(10)  NULL,
    "NationalId"       VARCHAR(20)  NULL,
    "Phone"            VARCHAR(20)  NULL,
    "Address"          VARCHAR(500) NULL,
    "EmergencyContact" VARCHAR(200) NULL,
    "BankAccountNo"    VARCHAR(50)  NULL,
    "BankName"         VARCHAR(100) NULL,
    "BankAccountName"  VARCHAR(200) NULL,
    "StartDate"        DATE NOT NULL,
    "IsActive"         BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt"        TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    "UpdatedAt"        TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS "Stores" (
    "Id"                        SERIAL PRIMARY KEY,
    "Name"                      VARCHAR(200) NOT NULL,
    "Address"                   VARCHAR(500) NULL,
    "Phone"                     VARCHAR(20)  NULL,
    "StandardWorkHoursPerDay"   NUMERIC(4,2) NOT NULL DEFAULT 8,
    "OvertimeRateMultiplier"    NUMERIC(4,2) NOT NULL DEFAULT 1.5,
    "IsActive"                  BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt"                 TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    "UpdatedAt"                 TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS "EmployeeStores" (
    "Id"         SERIAL PRIMARY KEY,
    "EmployeeId" INT NOT NULL REFERENCES "Employees"("Id"),
    "StoreId"    INT NOT NULL REFERENCES "Stores"("Id"),
    "AssignedAt" TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    UNIQUE ("EmployeeId", "StoreId")
);

CREATE TABLE IF NOT EXISTS "Shifts" (
    "Id"        SERIAL PRIMARY KEY,
    "StoreId"   INT NOT NULL REFERENCES "Stores"("Id"),
    "Name"      VARCHAR(100) NOT NULL,
    "StartTime" TIME NOT NULL,
    "EndTime"   TIME NOT NULL,
    "IsActive"  BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    CHECK ("EndTime" > "StartTime")
);

CREATE TABLE IF NOT EXISTS "ShiftRegistrations" (
    "Id"           SERIAL PRIMARY KEY,
    "EmployeeId"   INT NOT NULL REFERENCES "Employees"("Id"),
    "ShiftId"      INT NULL REFERENCES "Shifts"("Id"),
    "StartTime"    TIME NOT NULL,
    "EndTime"      TIME NOT NULL,
    "StoreId"      INT NOT NULL REFERENCES "Stores"("Id"),
    "WorkDate"     DATE NOT NULL,
    "Status"       VARCHAR(20) NOT NULL DEFAULT 'Pending'
        CHECK ("Status" IN ('Pending','Approved','Rejected','Cancelled')),
    "RejectReason" VARCHAR(500) NULL,
    "ReviewedBy"   INT NULL REFERENCES "Users"("Id"),
    "ReviewedAt"   TIMESTAMPTZ NULL,
    "CreatedAt"    TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    CHECK ("EndTime" > "StartTime"),
    UNIQUE ("EmployeeId", "StoreId", "WorkDate", "StartTime", "EndTime")
);

CREATE TABLE IF NOT EXISTS "Attendances" (
    "Id"            SERIAL PRIMARY KEY,
    "EmployeeId"    INT NOT NULL REFERENCES "Employees"("Id"),
    "StoreId"       INT NOT NULL REFERENCES "Stores"("Id"),
    "WorkDate"      DATE NOT NULL,
    "CheckIn"       TIME NOT NULL,
    "CheckOut"      TIME NULL,
    "OvertimeHours" NUMERIC(4,2) NOT NULL DEFAULT 0,
    "Status"        VARCHAR(20) NOT NULL DEFAULT 'Worked'
        CHECK ("Status" IN ('Worked','Absent')),
    "Note"          VARCHAR(500) NULL,
    "CreatedBy"     INT NOT NULL REFERENCES "Users"("Id"),
    "CreatedAt"     TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    "UpdatedBy"     INT NULL REFERENCES "Users"("Id"),
    "UpdatedAt"     TIMESTAMPTZ NULL,
    CHECK (
        "Status" = 'Absent'
        OR ("CheckOut" IS NOT NULL AND "CheckOut" > "CheckIn")
        OR ("CheckOut" IS NULL AND "Status" = 'Worked')
    ),
    UNIQUE ("EmployeeId", "StoreId", "WorkDate")
);

CREATE TABLE IF NOT EXISTS "SalaryCoefficients" (
    "Id"                SERIAL PRIMARY KEY,
    "EmployeeId"        INT NOT NULL REFERENCES "Employees"("Id"),
    "BaseSalaryPerHour" NUMERIC(18,2) NOT NULL,
    "Coefficient"       NUMERIC(5,2)  NOT NULL DEFAULT 1.0,
    "EffectiveFrom"     DATE NOT NULL,
    "Note"              VARCHAR(500) NULL,
    "CreatedBy"         INT NOT NULL REFERENCES "Users"("Id"),
    "CreatedAt"         TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE TABLE IF NOT EXISTS "Payrolls" (
    "Id"          SERIAL PRIMARY KEY,
    "StoreId"     INT NOT NULL REFERENCES "Stores"("Id"),
    "Month"       INT NOT NULL CHECK ("Month" BETWEEN 1 AND 12),
    "Year"        INT NOT NULL,
    "Status"      VARCHAR(20) NOT NULL DEFAULT 'Draft'
        CHECK ("Status" IN ('Draft','Approved','Paid')),
    "TotalAmount" NUMERIC(18,2) NOT NULL DEFAULT 0,
    "CreatedBy"   INT NOT NULL REFERENCES "Users"("Id"),
    "CreatedAt"   TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    "ApprovedBy"  INT NULL REFERENCES "Users"("Id"),
    "ApprovedAt"  TIMESTAMPTZ NULL,
    UNIQUE ("StoreId", "Month", "Year")
);

CREATE TABLE IF NOT EXISTS "PayrollDetails" (
    "Id"                SERIAL PRIMARY KEY,
    "PayrollId"         INT NOT NULL REFERENCES "Payrolls"("Id") ON DELETE CASCADE,
    "EmployeeId"        INT NOT NULL REFERENCES "Employees"("Id"),
    "WorkedDays"        NUMERIC(5,2)  NOT NULL DEFAULT 0,
    "WorkedHours"       NUMERIC(7,2)  NOT NULL DEFAULT 0,
    "OvertimeHours"     NUMERIC(5,2)  NOT NULL DEFAULT 0,
    "BaseSalaryPerHour" NUMERIC(18,2) NOT NULL,
    "Coefficient"       NUMERIC(5,2)  NOT NULL,
    "GrossSalary"       NUMERIC(18,2) NOT NULL,
    "Bonus"             NUMERIC(18,2) NOT NULL DEFAULT 0,
    "Deduction"         NUMERIC(18,2) NOT NULL DEFAULT 0,
    "Note"              VARCHAR(500) NULL,
    UNIQUE ("PayrollId", "EmployeeId")
);

CREATE TABLE IF NOT EXISTS "Payments" (
    "Id"            SERIAL PRIMARY KEY,
    "PayrollId"     INT NOT NULL REFERENCES "Payrolls"("Id"),
    "EmployeeId"    INT NOT NULL REFERENCES "Employees"("Id"),
    "Amount"        NUMERIC(18,2) NOT NULL,
    "PaymentDate"   DATE NOT NULL,
    "PaymentMethod" VARCHAR(50) NULL,
    "Note"          VARCHAR(500) NULL,
    "RecordedBy"    INT NOT NULL REFERENCES "Users"("Id"),
    "CreatedAt"     TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE TABLE IF NOT EXISTS "RefreshTokens" (
    "Id"        SERIAL PRIMARY KEY,
    "UserId"    INT NOT NULL REFERENCES "Users"("Id"),
    "Token"     VARCHAR(500) NOT NULL UNIQUE,
    "ExpiresAt" TIMESTAMPTZ NOT NULL,
    "IsRevoked" BOOLEAN NOT NULL DEFAULT FALSE,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);
