using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace WorkforceManagement.Api.Data;

public class AppDbContext : DbContext
{
	public DbSet<User> Users => Set<User>();

	public DbSet<Employee> Employees => Set<Employee>();

	public DbSet<Store> Stores => Set<Store>();

	public DbSet<EmployeeStore> EmployeeStores => Set<EmployeeStore>();

	public DbSet<Shift> Shifts => Set<Shift>();

	public DbSet<ShiftRegistration> ShiftRegistrations => Set<ShiftRegistration>();

	public DbSet<Attendance> Attendances => Set<Attendance>();

	public DbSet<SalaryCoefficient> SalaryCoefficients => Set<SalaryCoefficient>();

	public DbSet<Payroll> Payrolls => Set<Payroll>();

	public DbSet<PayrollDetail> PayrollDetails => Set<PayrollDetail>();

	public DbSet<Payment> Payments => Set<Payment>();

	public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

	public DbSet<SalaryGrade> SalaryGrades => Set<SalaryGrade>();

	public DbSet<Holiday> Holidays => Set<Holiday>();

	public DbSet<InsuranceRate> InsuranceRates => Set<InsuranceRate>();

	public DbSet<DeliveryAllowance> DeliveryAllowances => Set<DeliveryAllowance>();

	public DbSet<EmployeeInsurance> EmployeeInsurances => Set<EmployeeInsurance>();

	public DbSet<EmployeeInsuranceExpense> EmployeeInsuranceExpenses => Set<EmployeeInsuranceExpense>();

	public DbSet<EmployeeWorkExperience> EmployeeWorkExperiences => Set<EmployeeWorkExperience>();

	public DbSet<ShiftTemplate> ShiftTemplates => Set<ShiftTemplate>();

	public DbSet<Announcement> Announcements => Set<Announcement>();

	public DbSet<AnnouncementStore> AnnouncementStores => Set<AnnouncementStore>();

	public DbSet<SalaryRaiseRule> SalaryRaiseRules => Set<SalaryRaiseRule>();

	public AppDbContext(DbContextOptions<AppDbContext> options)
		: base(options)
	{
	}

	protected override void OnModelCreating(ModelBuilder mb)
	{
		mb.Entity<User>().ToTable("Users");
		mb.Entity<Employee>().ToTable("Employees");
		mb.Entity<EmployeeStore>().ToTable("EmployeeStores");
		mb.Entity<Shift>().ToTable("Shifts");
		mb.Entity<ShiftRegistration>().ToTable("ShiftRegistrations");
		mb.Entity<Attendance>().ToTable("Attendances");
		mb.Entity<SalaryCoefficient>().ToTable("SalaryCoefficients");
		mb.Entity<Payroll>().ToTable("Payrolls");
		mb.Entity<PayrollDetail>().ToTable("PayrollDetails");
		mb.Entity<Payment>().ToTable("Payments");
		mb.Entity<RefreshToken>().ToTable("RefreshTokens");
		mb.Entity<SalaryGrade>().ToTable("SalaryGrades");
		mb.Entity<Holiday>().ToTable("Holidays");
		mb.Entity<InsuranceRate>().ToTable("InsuranceRates");
		mb.Entity(delegate(EntityTypeBuilder<DeliveryAllowance> e)
		{
			e.ToTable("DeliveryAllowances");
			e.HasIndex((DeliveryAllowance x) => new { x.EmployeeId, x.Year, x.Month }).IsUnique();
			e.HasOne((DeliveryAllowance x) => x.Employee).WithMany().HasForeignKey((DeliveryAllowance x) => x.EmployeeId);
			e.HasOne((DeliveryAllowance x) => x.Store).WithMany().HasForeignKey((DeliveryAllowance x) => x.StoreId);
			e.HasOne((DeliveryAllowance x) => x.UpdatedByUser).WithMany().HasForeignKey((DeliveryAllowance x) => x.UpdatedBy)
				.IsRequired(required: false);
		});
		mb.Entity(delegate(EntityTypeBuilder<EmployeeInsurance> e)
		{
			e.ToTable("EmployeeInsurances");
			e.HasKey((EmployeeInsurance x) => x.EmployeeId);
			e.HasOne((EmployeeInsurance x) => x.Employee).WithOne().HasForeignKey((EmployeeInsurance x) => x.EmployeeId);
			e.HasOne((EmployeeInsurance x) => x.InsuranceRate).WithMany().HasForeignKey((EmployeeInsurance x) => x.InsuranceRateId)
				.IsRequired(required: false);
			e.HasOne((EmployeeInsurance x) => x.UpdatedByUser).WithMany().HasForeignKey((EmployeeInsurance x) => x.UpdatedBy)
				.IsRequired(required: false);
		});
		mb.Entity(delegate(EntityTypeBuilder<EmployeeInsuranceExpense> e)
		{
			e.ToTable("EmployeeInsuranceExpenses");
			e.HasIndex((EmployeeInsuranceExpense x) => new { x.EmployeeId, x.Year, x.Month }).IsUnique();
			e.HasOne((EmployeeInsuranceExpense x) => x.Employee).WithMany().HasForeignKey((EmployeeInsuranceExpense x) => x.EmployeeId);
			e.HasOne((EmployeeInsuranceExpense x) => x.CreatedByUser).WithMany().HasForeignKey((EmployeeInsuranceExpense x) => x.CreatedBy)
				.IsRequired(required: false);
		});
		mb.Entity(delegate(EntityTypeBuilder<EmployeeWorkExperience> e)
		{
			e.ToTable("EmployeeWorkExperiences");
			e.HasOne((EmployeeWorkExperience x) => x.Employee).WithMany().HasForeignKey((EmployeeWorkExperience x) => x.EmployeeId)
				.OnDelete(DeleteBehavior.Cascade);
		});
		mb.Entity<ShiftTemplate>().ToTable("ShiftTemplates");
		mb.Entity(delegate(EntityTypeBuilder<Announcement> e)
		{
			e.ToTable("Announcements");
			e.HasOne((Announcement x) => x.Creator).WithMany().HasForeignKey((Announcement x) => x.CreatedBy)
				.IsRequired(required: false)
				.OnDelete(DeleteBehavior.SetNull);
		});
		mb.Entity(delegate(EntityTypeBuilder<AnnouncementStore> e)
		{
			e.ToTable("AnnouncementStores");
			e.HasKey((AnnouncementStore x) => new { x.AnnouncementId, x.StoreId });
			e.HasOne((AnnouncementStore x) => x.Announcement).WithMany((Announcement x) => x.AnnouncementStores).HasForeignKey((AnnouncementStore x) => x.AnnouncementId)
				.OnDelete(DeleteBehavior.Cascade);
			e.HasOne((AnnouncementStore x) => x.Store).WithMany().HasForeignKey((AnnouncementStore x) => x.StoreId)
				.OnDelete(DeleteBehavior.Restrict);
		});
		mb.Entity<SalaryRaiseRule>().ToTable("SalaryRaiseRules");
		mb.Entity(delegate(EntityTypeBuilder<User> e)
		{
			e.HasIndex((User x) => x.Username).IsUnique();
			e.HasIndex((User x) => x.Email).IsUnique();
			e.Property((User x) => x.Role).HasMaxLength(20);
		});
		mb.Entity(delegate(EntityTypeBuilder<Employee> e)
		{
			e.HasIndex((Employee x) => x.EmployeeCode).IsUnique();
			e.HasOne((Employee x) => x.User).WithOne((User x) => x.Employee).HasForeignKey((Employee x) => x.UserId);
			e.HasOne((Employee x) => x.PrimaryStore).WithMany().HasForeignKey((Employee x) => x.PrimaryStoreId)
				.IsRequired(required: false)
				.OnDelete(DeleteBehavior.SetNull);
		});
		mb.Entity(delegate(EntityTypeBuilder<Store> e)
		{
			e.ToTable("Stores");
			e.HasOne((Store x) => x.Manager).WithMany().HasForeignKey((Store x) => x.ManagerEmployeeId)
				.IsRequired(required: false);
			e.HasIndex((Store x) => x.ManagerEmployeeId).IsUnique().HasFilter("[ManagerEmployeeId] IS NOT NULL");
		});
		mb.Entity(delegate(EntityTypeBuilder<EmployeeStore> e)
		{
			e.HasIndex((EmployeeStore x) => new { x.EmployeeId, x.StoreId }).IsUnique();
			e.HasOne((EmployeeStore x) => x.Employee).WithMany((Employee x) => x.EmployeeStores).HasForeignKey((EmployeeStore x) => x.EmployeeId);
			e.HasOne((EmployeeStore x) => x.Store).WithMany((Store x) => x.EmployeeStores).HasForeignKey((EmployeeStore x) => x.StoreId);
		});
		mb.Entity(delegate(EntityTypeBuilder<ShiftRegistration> e)
		{
			e.HasIndex((ShiftRegistration x) => new { x.EmployeeId, x.StoreId, x.WorkDate, x.StartTime, x.EndTime }).IsUnique();
			e.HasOne((ShiftRegistration x) => x.Employee).WithMany((Employee x) => x.ShiftRegistrations).HasForeignKey((ShiftRegistration x) => x.EmployeeId);
			e.HasOne((ShiftRegistration x) => x.Shift).WithMany((Shift x) => x.ShiftRegistrations).HasForeignKey((ShiftRegistration x) => x.ShiftId)
				.IsRequired(required: false);
			e.HasOne((ShiftRegistration x) => x.Store).WithMany().HasForeignKey((ShiftRegistration x) => x.StoreId);
			e.HasOne((ShiftRegistration x) => x.Reviewer).WithMany().HasForeignKey((ShiftRegistration x) => x.ReviewedBy)
				.IsRequired(required: false);
		});
		mb.Entity(delegate(EntityTypeBuilder<Attendance> e)
		{
			e.HasIndex((Attendance x) => new { x.EmployeeId, x.ShiftRegistrationId }).IsUnique().HasFilter("[ShiftRegistrationId] IS NOT NULL")
				.HasDatabaseName("UQ_Attendances_Employee_ShiftReg");
			e.Ignore((Attendance x) => x.WorkedHours);
			e.HasOne((Attendance x) => x.Employee).WithMany((Employee x) => x.Attendances).HasForeignKey((Attendance x) => x.EmployeeId);
			e.HasOne((Attendance x) => x.Store).WithMany((Store x) => x.Attendances).HasForeignKey((Attendance x) => x.StoreId);
			e.HasOne((Attendance x) => x.CreatedByUser).WithMany().HasForeignKey((Attendance x) => x.CreatedBy)
				.OnDelete(DeleteBehavior.Restrict);
			e.HasOne((Attendance x) => x.UpdatedByUser).WithMany().HasForeignKey((Attendance x) => x.UpdatedBy)
				.IsRequired(required: false)
				.OnDelete(DeleteBehavior.Restrict);
		});
		mb.Entity(delegate(EntityTypeBuilder<SalaryCoefficient> e)
		{
			e.HasOne((SalaryCoefficient x) => x.Employee).WithMany((Employee x) => x.SalaryCoefficients).HasForeignKey((SalaryCoefficient x) => x.EmployeeId);
			e.HasOne((SalaryCoefficient x) => x.CreatedByUser).WithMany().HasForeignKey((SalaryCoefficient x) => x.CreatedBy)
				.OnDelete(DeleteBehavior.Restrict);
		});
		mb.Entity(delegate(EntityTypeBuilder<Payroll> e)
		{
			e.HasIndex((Payroll x) => new { x.StoreId, x.Month, x.Year }).IsUnique();
			e.HasOne((Payroll x) => x.Store).WithMany((Store x) => x.Payrolls).HasForeignKey((Payroll x) => x.StoreId);
			e.HasOne((Payroll x) => x.CreatedByUser).WithMany().HasForeignKey((Payroll x) => x.CreatedBy)
				.OnDelete(DeleteBehavior.Restrict);
			e.HasOne((Payroll x) => x.ApprovedByUser).WithMany().HasForeignKey((Payroll x) => x.ApprovedBy)
				.IsRequired(required: false)
				.OnDelete(DeleteBehavior.Restrict);
		});
		mb.Entity(delegate(EntityTypeBuilder<PayrollDetail> e)
		{
			e.HasIndex((PayrollDetail x) => new { x.PayrollId, x.EmployeeId }).IsUnique();
			e.Ignore((PayrollDetail x) => x.NetSalary);
			e.HasOne((PayrollDetail x) => x.Payroll).WithMany((Payroll x) => x.Details).HasForeignKey((PayrollDetail x) => x.PayrollId);
			e.HasOne((PayrollDetail x) => x.Employee).WithMany((Employee x) => x.PayrollDetails).HasForeignKey((PayrollDetail x) => x.EmployeeId)
				.OnDelete(DeleteBehavior.Restrict);
		});
		mb.Entity(delegate(EntityTypeBuilder<Payment> e)
		{
			e.HasOne((Payment x) => x.Payroll).WithMany((Payroll x) => x.Payments).HasForeignKey((Payment x) => x.PayrollId);
			e.HasOne((Payment x) => x.Employee).WithMany().HasForeignKey((Payment x) => x.EmployeeId)
				.OnDelete(DeleteBehavior.Restrict);
			e.HasOne((Payment x) => x.RecordedByUser).WithMany().HasForeignKey((Payment x) => x.RecordedBy)
				.OnDelete(DeleteBehavior.Restrict);
		});
		mb.Entity(delegate(EntityTypeBuilder<RefreshToken> e)
		{
			e.HasIndex((RefreshToken x) => x.Token).IsUnique();
			e.HasOne((RefreshToken x) => x.User).WithMany((User x) => x.RefreshTokens).HasForeignKey((RefreshToken x) => x.UserId);
		});
		mb.Entity(delegate(EntityTypeBuilder<SalaryGrade> e)
		{
			e.HasIndex((SalaryGrade x) => x.Code).IsUnique();
			e.Property((SalaryGrade x) => x.Code).HasMaxLength(20);
			e.Property((SalaryGrade x) => x.Type).HasMaxLength(10);
		});
		mb.Entity(delegate(EntityTypeBuilder<Holiday> e)
		{
			e.HasIndex((Holiday x) => x.Date).IsUnique();
		});
	}
}
