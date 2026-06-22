-- ============================================================
-- Workforce Management — Schema
-- Chạy trên DB: WorkforceManagement
-- ============================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'WorkforceManagement')
    CREATE DATABASE WorkforceManagement;
GO

USE WorkforceManagement;
GO

-- Users
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
CREATE TABLE Users (
    Id           INT IDENTITY(1,1) PRIMARY KEY,
    Username     NVARCHAR(100) NOT NULL,
    Email        NVARCHAR(200) NOT NULL,
    PasswordHash NVARCHAR(500) NOT NULL,
    Role         NVARCHAR(20)  NOT NULL DEFAULT 'Employee'
                 CONSTRAINT CK_Users_Role CHECK (Role IN ('Admin','Manager','Employee')),
    IsActive     BIT NOT NULL DEFAULT 1,
    CreatedAt    DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt    DATETIME2 NULL,
    CONSTRAINT UQ_Users_Username UNIQUE (Username),
    CONSTRAINT UQ_Users_Email    UNIQUE (Email)
);
GO

-- Employees
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Employees' AND xtype='U')
CREATE TABLE Employees (
    Id               INT IDENTITY(1,1) PRIMARY KEY,
    UserId           INT NOT NULL UNIQUE REFERENCES Users(Id),
    EmployeeCode     NVARCHAR(20)  NOT NULL,
    FullName         NVARCHAR(200) NOT NULL,
    DateOfBirth      DATE NULL,
    Gender           NVARCHAR(10)  NULL,
    NationalId       NVARCHAR(20)  NULL,
    Phone            NVARCHAR(20)  NULL,
    Address          NVARCHAR(500) NULL,
    EmergencyContact NVARCHAR(200) NULL,
    BankAccountNo    NVARCHAR(50)  NULL,
    BankName         NVARCHAR(100) NULL,
    BankAccountName  NVARCHAR(200) NULL,
    StartDate        DATE NOT NULL,
    IsActive         BIT NOT NULL DEFAULT 1,
    CreatedAt        DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt        DATETIME2 NULL,
    CONSTRAINT UQ_Employees_Code UNIQUE (EmployeeCode)
);
GO

-- Stores
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Stores' AND xtype='U')
CREATE TABLE Stores (
    Id        INT IDENTITY(1,1) PRIMARY KEY,
    Name      NVARCHAR(200) NOT NULL,
    Address   NVARCHAR(500) NULL,
    Phone     NVARCHAR(20)  NULL,
    StandardWorkHoursPerDay DECIMAL(4,2) NOT NULL DEFAULT 8,
    OvertimeRateMultiplier  DECIMAL(4,2) NOT NULL DEFAULT 1.5,
    IsActive  BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NULL
);
GO

-- EmployeeStores (nhiều-nhiều)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EmployeeStores' AND xtype='U')
CREATE TABLE EmployeeStores (
    Id         INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeId INT NOT NULL REFERENCES Employees(Id),
    StoreId    INT NOT NULL REFERENCES Stores(Id),
    AssignedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_EmployeeStores UNIQUE (EmployeeId, StoreId)
);
GO

-- Shifts
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Shifts' AND xtype='U')
CREATE TABLE Shifts (
    Id        INT IDENTITY(1,1) PRIMARY KEY,
    StoreId   INT NOT NULL REFERENCES Stores(Id),
    Name      NVARCHAR(100) NOT NULL,
    StartTime TIME NOT NULL,
    EndTime   TIME NOT NULL,
    IsActive  BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT CK_Shifts_Time CHECK (EndTime > StartTime)
);
GO

-- ShiftRegistrations
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ShiftRegistrations' AND xtype='U')
CREATE TABLE ShiftRegistrations (
    Id           INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeId   INT NOT NULL REFERENCES Employees(Id),
    ShiftId      INT NULL REFERENCES Shifts(Id),
    StartTime    TIME NOT NULL,
    EndTime      TIME NOT NULL,
    StoreId      INT NOT NULL REFERENCES Stores(Id),
    WorkDate     DATE NOT NULL,
    Status       NVARCHAR(20) NOT NULL DEFAULT 'Pending'
                 CONSTRAINT CK_ShiftReg_Status CHECK (Status IN ('Pending','Approved','Rejected','Cancelled')),
    RejectReason NVARCHAR(500) NULL,
    ReviewedBy   INT NULL REFERENCES Users(Id),
    ReviewedAt   DATETIME2 NULL,
    CreatedAt    DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT CK_ShiftRegistrations_Time CHECK (EndTime > StartTime),
    CONSTRAINT UQ_ShiftReg_StoreDateTime UNIQUE (EmployeeId, StoreId, WorkDate, StartTime, EndTime)
);
GO

-- Attendances
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Attendances' AND xtype='U')
CREATE TABLE Attendances (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeId    INT NOT NULL REFERENCES Employees(Id),
    StoreId       INT NOT NULL REFERENCES Stores(Id),
    WorkDate      DATE NOT NULL,
    CheckIn       TIME NOT NULL,
    CheckOut      TIME NULL,
    OvertimeHours DECIMAL(4,2) NOT NULL DEFAULT 0,
    Status        NVARCHAR(20) NOT NULL DEFAULT 'Worked'
                  CONSTRAINT CK_Attendance_Status CHECK (Status IN ('Worked','Absent','Present','Late')),
    Note          NVARCHAR(500) NULL,
    CreatedBy     INT NOT NULL REFERENCES Users(Id),
    CreatedAt     DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedBy     INT NULL REFERENCES Users(Id),
    UpdatedAt     DATETIME2 NULL,
    CONSTRAINT CK_Attendance_Time CHECK (
        Status = 'Absent' OR (CheckOut IS NOT NULL AND CheckOut > CheckIn) OR CheckOut IS NULL),
    CONSTRAINT UQ_Attendances UNIQUE (EmployeeId, StoreId, WorkDate)
);
GO

-- SalaryCoefficients (append-only, không xóa)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SalaryCoefficients' AND xtype='U')
CREATE TABLE SalaryCoefficients (
    Id               INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeId       INT NOT NULL REFERENCES Employees(Id),
    BaseSalaryPerHour DECIMAL(18,2) NOT NULL,
    Coefficient      DECIMAL(5,2)  NOT NULL DEFAULT 1.0,
    EffectiveFrom    DATE NOT NULL,   -- Ngày 1 của tháng áp dụng
    Note             NVARCHAR(500) NULL,
    CreatedBy        INT NOT NULL REFERENCES Users(Id),
    CreatedAt        DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
GO

-- Payrolls
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Payrolls' AND xtype='U')
CREATE TABLE Payrolls (
    Id          INT IDENTITY(1,1) PRIMARY KEY,
    StoreId     INT NOT NULL REFERENCES Stores(Id),
    Month       INT NOT NULL CONSTRAINT CK_Payroll_Month CHECK (Month BETWEEN 1 AND 12),
    Year        INT NOT NULL,
    Status      NVARCHAR(20) NOT NULL DEFAULT 'Draft'
                CONSTRAINT CK_Payroll_Status CHECK (Status IN ('Draft','Approved','Paid')),
    TotalAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    CreatedBy   INT NOT NULL REFERENCES Users(Id),
    CreatedAt   DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    ApprovedBy  INT NULL REFERENCES Users(Id),
    ApprovedAt  DATETIME2 NULL,
    CONSTRAINT UQ_Payrolls UNIQUE (StoreId, Month, Year)
);
GO

-- PayrollDetails
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PayrollDetails' AND xtype='U')
CREATE TABLE PayrollDetails (
    Id               INT IDENTITY(1,1) PRIMARY KEY,
    PayrollId        INT NOT NULL REFERENCES Payrolls(Id),
    EmployeeId       INT NOT NULL REFERENCES Employees(Id),
    WorkedDays       DECIMAL(5,2)  NOT NULL DEFAULT 0,
    WorkedHours      DECIMAL(7,2)  NOT NULL DEFAULT 0,
    OvertimeHours    DECIMAL(5,2)  NOT NULL DEFAULT 0,
    BaseSalaryPerHour DECIMAL(18,2) NOT NULL,
    Coefficient      DECIMAL(5,2)  NOT NULL,
    GrossSalary      DECIMAL(18,2) NOT NULL,
    Bonus            DECIMAL(18,2) NOT NULL DEFAULT 0,
    Deduction        DECIMAL(18,2) NOT NULL DEFAULT 0,
    Note             NVARCHAR(500) NULL,
    CONSTRAINT UQ_PayrollDetails UNIQUE (PayrollId, EmployeeId)
);
GO

-- Payments
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Payments' AND xtype='U')
CREATE TABLE Payments (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    PayrollId     INT NOT NULL REFERENCES Payrolls(Id),
    EmployeeId    INT NOT NULL REFERENCES Employees(Id),
    Amount        DECIMAL(18,2) NOT NULL,
    PaymentDate   DATE NOT NULL,
    PaymentMethod NVARCHAR(50) NULL,
    Note          NVARCHAR(500) NULL,
    RecordedBy    INT NOT NULL REFERENCES Users(Id),
    CreatedAt     DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
GO

-- RefreshTokens
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RefreshTokens' AND xtype='U')
CREATE TABLE RefreshTokens (
    Id        INT IDENTITY(1,1) PRIMARY KEY,
    UserId    INT NOT NULL REFERENCES Users(Id),
    Token     NVARCHAR(500) NOT NULL,
    ExpiresAt DATETIME2 NOT NULL,
    IsRevoked BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_RefreshTokens UNIQUE (Token)
);
GO

PRINT 'Schema created successfully.';
