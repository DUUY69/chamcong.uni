using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Models.Payroll;

namespace WorkforceManagement.Api.Services;

public class PayrollService
{
	private readonly AppDbContext _db;

	public PayrollService(AppDbContext db)
	{
		_db = db;
	}

	public async Task<PayrollDto> GenerateAsync(GeneratePayrollDto req, int createdBy)
	{
		Payroll existing = await _db.Payrolls.Include((Payroll p) => p.Details).FirstOrDefaultAsync((Payroll p) => p.StoreId == req.StoreId && p.Month == req.Month && p.Year == req.Year);
		if (existing != null && existing.Status != "Draft")
		{
			throw new InvalidOperationException($"Bảng lương tháng {req.Month}/{req.Year} đã {existing.Status}, không thể tính lại.");
		}
		Store store = (await _db.Stores.AsNoTracking().FirstOrDefaultAsync((Store s) => s.Id == req.StoreId)) ?? throw new InvalidOperationException($"Không tìm thấy cửa hàng Id={req.StoreId} trong DB.");
		if (store.StandardWorkHoursPerDay <= 0m)
		{
			throw new InvalidOperationException("Cửa hàng chưa cấu hình giờ công chuẩn/ngày trong DB.");
		}
		DateOnly dateFrom = new DateOnly(req.Year, req.Month, 1);
		DateOnly dateTo = dateFrom.AddMonths(1).AddDays(-1);
		List<Attendance> attendances = await _db.Attendances.Where((Attendance a) => a.StoreId == req.StoreId && a.WorkDate >= dateFrom && a.WorkDate <= dateTo && a.Status == "Worked" && a.ReviewStatus == "Confirmed" && a.CheckOut != null).ToListAsync();
		List<int> employeeIds = attendances.Select((Attendance a) => a.EmployeeId).Distinct().ToList();
		if (employeeIds.Count == 0)
		{
			throw new InvalidOperationException($"Không có chấm công «Đi làm» đã ra ca tại cửa hàng này trong tháng {req.Month}/{req.Year}.");
		}
		List<Employee> employees = await _db.Employees.Where((Employee e) => employeeIds.Contains(e.Id) && e.IsActive).ToListAsync();
		List<SalaryCoefficient> coefficients = await (from sc in _db.SalaryCoefficients
			where employeeIds.Contains(sc.EmployeeId) && sc.EffectiveFrom <= dateFrom
			orderby sc.EffectiveFrom descending, sc.CreatedAt descending
			select sc).ToListAsync();
		Dictionary<int, EmployeeInsurance> insurances = await (from i in _db.EmployeeInsurances.Include((EmployeeInsurance i) => i.InsuranceRate)
			where employeeIds.Contains(i.EmployeeId)
			select i).ToDictionaryAsync((EmployeeInsurance i) => i.EmployeeId);
		Dictionary<DateOnly, decimal> holidayMap = (await _db.Holidays.Where((Holiday h) => h.IsActive && h.Date >= dateFrom && h.Date <= dateTo).ToListAsync()).ToDictionary((Holiday h) => h.Date, (Holiday h) => h.Multiplier);
		Payroll payroll;
		if (existing != null)
		{
			payroll = existing;
			_db.PayrollDetails.RemoveRange(existing.Details);
		}
		else
		{
			payroll = new Payroll
			{
				StoreId = req.StoreId,
				Month = req.Month,
				Year = req.Year,
				CreatedBy = createdBy
			};
			_db.Payrolls.Add(payroll);
			await _db.SaveChangesAsync();
		}
		List<PayrollDetail> list = new List<PayrollDetail>();
		foreach (Employee emp in employees)
		{
			List<Attendance> list2 = attendances.Where((Attendance a) => a.EmployeeId == emp.Id).ToList();
			if (list2.Count == 0)
			{
				continue;
			}
			int num = list2.Select((Attendance a) => a.WorkDate).Distinct().Count();
			decimal workedHours = list2.Sum((Attendance a) => a.WorkedHours);
			decimal overtimeHours = list2.Sum((Attendance a) => a.OvertimeHours);
			SalaryCoefficient salaryCoefficient = coefficients.FirstOrDefault((SalaryCoefficient sc) => sc.EmployeeId == emp.Id);
			decimal num2 = salaryCoefficient?.BaseSalaryPerHour ?? 0m;
			string text = salaryCoefficient?.SalaryType ?? "Hourly";
			decimal overtimeRateMultiplier = store.OvertimeRateMultiplier;
			decimal grossSalary;
			if (text == "Monthly")
			{
				decimal num3 = num2 / 26m;
				grossSalary = Math.Round(num2 * (decimal)num / 26m, 0);
				foreach (Attendance item in list2)
				{
					if (holidayMap.TryGetValue(item.WorkDate, out var value))
					{
						grossSalary += Math.Round(num3 * (value - 1m), 0);
					}
				}
			}
			else
			{
				grossSalary = default(decimal);
				foreach (Attendance item2 in list2)
				{
					if (holidayMap.TryGetValue(item2.WorkDate, out var value2))
					{
						grossSalary += item2.WorkedHours * num2 * value2;
						continue;
					}
					decimal num4 = Math.Max(0m, item2.WorkedHours - item2.OvertimeHours);
					grossSalary += num4 * num2 + item2.OvertimeHours * num2 * overtimeRateMultiplier;
				}
				grossSalary = Math.Round(grossSalary, 0);
			}
			decimal num5 = default(decimal);
			int num6 = (dateFrom.Year - emp.StartDate.Year) * 12 + (dateFrom.Month - emp.StartDate.Month);
			if (num6 > 2 && emp.DateOfBirth.HasValue && emp.DateOfBirth.Value.Month == req.Month)
			{
				num5 = 300000m;
			}
			decimal num7 = default(decimal);
			if (insurances.TryGetValue(emp.Id, out var value3) && value3.Mode == "CompanyProvided")
			{
				InsuranceRate insuranceRate = value3.InsuranceRate;
				if (insuranceRate != null && insuranceRate.IsActive)
				{
					num7 = insuranceRate.Amount;
				}
				else if (value3.MonthlyPremium > 0m)
				{
					num7 = value3.MonthlyPremium;
				}
			}
			List<string> list3 = new List<string>();
			if (num5 > 0m)
			{
				list3.Add("Phụ cấp sinh nhật 300.000đ");
			}
			if (num7 > 0m)
			{
				list3.Add($"Trừ BH công ty: {num7:N0}đ");
			}
			list.Add(new PayrollDetail
			{
				PayrollId = payroll.Id,
				EmployeeId = emp.Id,
				WorkedDays = num,
				WorkedHours = workedHours,
				OvertimeHours = overtimeHours,
				BaseSalaryPerHour = num2,
				Coefficient = 1m,
				GrossSalary = grossSalary,
				Bonus = num5,
				DeliveryAllowance = 0m,
				InsuranceDeduction = num7,
				Deduction = num7,
				Note = ((list3.Count > 0) ? string.Join("; ", list3) : null)
			});
		}
		_db.PayrollDetails.AddRange(list);
		payroll.TotalAmount = list.Sum((PayrollDetail d) => d.GrossSalary + d.Bonus + d.DeliveryAllowance - d.Deduction);
		await _db.SaveChangesAsync();
		return await GetByIdAsync(payroll.Id);
	}

	public async Task<PayrollDto> GetByIdAsync(int id)
	{
		Payroll p = (await _db.Payrolls.Include((Payroll x) => x.Store).Include((Payroll x) => x.Details).ThenInclude((PayrollDetail d) => d.Employee)
			.FirstOrDefaultAsync((Payroll x) => x.Id == id)) ?? throw new KeyNotFoundException("Không tìm thấy bảng lương.");
		return MapDto(p);
	}

	public async Task<List<PayrollDto>> GetAllAsync(int? storeId, int? month, int? year, string? status)
	{
		IQueryable<Payroll> source = _db.Payrolls.Include((Payroll x) => x.Store).Include((Payroll x) => x.Details).ThenInclude((PayrollDetail d) => d.Employee)
			.AsQueryable();
		if (storeId.HasValue)
		{
			source = source.Where((Payroll x) => x.StoreId == ((int?)storeId).Value);
		}
		if (month.HasValue)
		{
			source = source.Where((Payroll x) => x.Month == ((int?)month).Value);
		}
		if (year.HasValue)
		{
			source = source.Where((Payroll x) => x.Year == ((int?)year).Value);
		}
		if (!string.IsNullOrEmpty(status))
		{
			source = source.Where((Payroll x) => x.Status == status);
		}
		return (await (from x in source
			orderby x.Year descending, x.Month descending
			select x).ToListAsync()).Select(MapDto).ToList();
	}

	public async Task<PayrollDto> ApproveAsync(int id, int approvedBy)
	{
		Payroll payroll = (await _db.Payrolls.FindAsync(id)) ?? throw new KeyNotFoundException();
		if (payroll.Status != "Draft")
		{
			throw new InvalidOperationException("Chỉ có thể duyệt bảng lương ở trạng thái Draft.");
		}
		payroll.Status = "Approved";
		payroll.ApprovedBy = approvedBy;
		payroll.ApprovedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync();
		return await GetByIdAsync(id);
	}

	public async Task<PayrollDto> MarkPaidAsync(int id, int recordedBy)
	{
		Payroll payroll = (await _db.Payrolls.Include((Payroll x) => x.Details).ThenInclude((PayrollDetail d) => d.Employee).FirstOrDefaultAsync((Payroll x) => x.Id == id)) ?? throw new KeyNotFoundException();
		if (payroll.Status != "Approved")
		{
			throw new InvalidOperationException("Chỉ có thể đánh dấu đã trả khi bảng lương đã Approved.");
		}
		payroll.Status = "Paid";
		foreach (PayrollDetail detail in payroll.Details)
		{
			_db.Payments.Add(new Payment
			{
				PayrollId = payroll.Id,
				EmployeeId = detail.EmployeeId,
				Amount = detail.NetSalary,
				PaymentDate = DateOnly.FromDateTime(DateTime.UtcNow),
				PaymentMethod = "Transfer",
				RecordedBy = recordedBy
			});
		}
		await _db.SaveChangesAsync();
		return await GetByIdAsync(id);
	}

	public async Task UpdateDetailAsync(int payrollId, int detailId, UpdatePayrollDetailDto dto)
	{
		Payroll p = (await _db.Payrolls.FindAsync(payrollId)) ?? throw new KeyNotFoundException();
		if (p.Status != "Draft")
		{
			throw new InvalidOperationException("Chỉ có thể sửa bảng lương ở trạng thái Draft.");
		}
		PayrollDetail payrollDetail = (await _db.PayrollDetails.FindAsync(detailId)) ?? throw new KeyNotFoundException();
		if (payrollDetail.PayrollId != payrollId)
		{
			throw new InvalidOperationException("Detail không thuộc payroll này.");
		}
		if (dto.Bonus.HasValue)
		{
			payrollDetail.Bonus = dto.Bonus.Value;
		}
		if (dto.DeliveryAllowance.HasValue)
		{
			payrollDetail.DeliveryAllowance = Math.Max(0m, dto.DeliveryAllowance.Value);
		}
		if (dto.Deduction.HasValue)
		{
			payrollDetail.Deduction = Math.Max(payrollDetail.InsuranceDeduction, dto.Deduction.Value);
		}
		if (dto.Note != null)
		{
			payrollDetail.Note = dto.Note;
		}
		Payroll payroll = p;
		payroll.TotalAmount = await _db.PayrollDetails.Where((PayrollDetail d) => d.PayrollId == payrollId).SumAsync((PayrollDetail d) => d.GrossSalary + d.Bonus + d.DeliveryAllowance - d.Deduction);
		await _db.SaveChangesAsync();
	}

	private static PayrollDto MapDto(Payroll p)
	{
		return new PayrollDto
		{
			Id = p.Id,
			StoreId = p.StoreId,
			StoreName = (p.Store?.Name ?? ""),
			Month = p.Month,
			Year = p.Year,
			Status = p.Status,
			TotalAmount = p.TotalAmount,
			CreatedAt = p.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
			ApprovedAt = p.ApprovedAt?.ToString("yyyy-MM-dd HH:mm"),
			Details = p.Details.Select((PayrollDetail d) => new PayrollDetailDto
			{
				Id = d.Id,
				EmployeeId = d.EmployeeId,
				EmployeeName = (d.Employee?.FullName ?? ""),
				EmployeeCode = (d.Employee?.EmployeeCode ?? ""),
				BankAccountNo = d.Employee?.BankAccountNo,
				BankName = d.Employee?.BankName,
				BankAccountName = d.Employee?.BankAccountName,
				WorkedDays = d.WorkedDays,
				WorkedHours = d.WorkedHours,
				OvertimeHours = d.OvertimeHours,
				BaseSalaryPerHour = d.BaseSalaryPerHour,
				Coefficient = d.Coefficient,
				GrossSalary = d.GrossSalary,
				Bonus = d.Bonus,
				DeliveryAllowance = d.DeliveryAllowance,
				InsuranceDeduction = d.InsuranceDeduction,
				Deduction = d.Deduction,
				NetSalary = d.NetSalary,
				Note = d.Note
			}).ToList()
		};
	}
}
