using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using WorkforceManagement.Api.Data;
using WorkforceManagement.Api.Models;
using WorkforceManagement.Api.Models.Config;

namespace WorkforceManagement.Api.Controllers;

[ApiController]
[Route("api/config")]
[Authorize]
public class ConfigController : ControllerBase
{
    private readonly AppDbContext _db;
    public ConfigController(AppDbContext db) => _db = db;

    [HttpGet("shift-templates")]
    public async Task<IActionResult> GetShiftTemplates([FromQuery] bool? activeOnly)
    {
        try
        {
            var q = _db.ShiftTemplates.AsQueryable();
            if (activeOnly == true)
                q = q.Where(x => x.IsActive);

            var list = await q.OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync();
            return Ok(ApiResponse<List<ShiftTemplateDto>>.Ok(list.Select(MapShiftTemplate).ToList()));
        }
        catch (Exception)
        {
            return Ok(ApiResponse<List<ShiftTemplateDto>>.Ok(new()));
        }
    }

    [HttpGet("salary-grades")]
    public async Task<IActionResult> GetSalaryGrades([FromQuery] bool? activeOnly)
    {
        try
        {
            var q = _db.SalaryGrades.AsQueryable();
            if (activeOnly == true)
                q = q.Where(x => x.IsActive);

            var list = await q.OrderBy(x => x.Code).ToListAsync();
            return Ok(ApiResponse<List<SalaryGradeDto>>.Ok(list.Select(MapSalaryGrade).ToList()));
        }
        catch (Exception)
        {
            // DB thiếu bảng/cột hoặc schema cũ — trả [] thay vì 500 (chạy 05_SQL-SALARY-INSURANCE-TABLES.sql để có dữ liệu)
            return Ok(ApiResponse<List<SalaryGradeDto>>.Ok(new()));
        }
    }



    [HttpPost("salary-grades")]

    [Authorize(Roles = "Admin")]

    public async Task<IActionResult> CreateSalaryGrade([FromBody] SaveSalaryGradeDto dto)

    {

        if (string.IsNullOrWhiteSpace(dto.Code))

            return BadRequest(ApiResponse.Fail("Mã bậc lương không được để trống."));

        if (dto.Value <= 0)

            return BadRequest(ApiResponse.Fail("Giá trị bậc lương phải lớn hơn 0."));



        var code = dto.Code.Trim().ToUpperInvariant();

        if (await _db.SalaryGrades.AnyAsync(x => x.Code == code))

            return BadRequest(ApiResponse.Fail($"Mã '{code}' đã tồn tại."));



        var grade = new SalaryGrade

        {

            Code = code,

            Label = dto.Label?.Trim(),

            Value = dto.Value,

            Type = string.IsNullOrWhiteSpace(dto.Type) ? "Hourly" : dto.Type.Trim(),

            IsActive = dto.IsActive,

            MinTenureMonths = dto.MinTenureMonths,

            MinWorkedHours = dto.MinWorkedHours,

            RaiseConditionNote = dto.RaiseConditionNote?.Trim(),

        };

        _db.SalaryGrades.Add(grade);

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<SalaryGradeDto>.Ok(MapSalaryGrade(grade), "Tạo bậc lương thành công."));

    }



    [HttpPut("salary-grades/{id:int}")]

    [Authorize(Roles = "Admin")]

    public async Task<IActionResult> UpdateSalaryGrade(int id, [FromBody] SaveSalaryGradeDto dto)

    {

        var grade = await _db.SalaryGrades.FindAsync(id);

        if (grade == null) return NotFound(ApiResponse.Fail("Không tìm thấy bậc lương."));

        if (string.IsNullOrWhiteSpace(dto.Code))

            return BadRequest(ApiResponse.Fail("Mã bậc lương không được để trống."));

        if (dto.Value <= 0)

            return BadRequest(ApiResponse.Fail("Giá trị bậc lương phải lớn hơn 0."));



        var code = dto.Code.Trim().ToUpperInvariant();

        if (await _db.SalaryGrades.AnyAsync(x => x.Code == code && x.Id != id))

            return BadRequest(ApiResponse.Fail($"Mã '{code}' đã tồn tại."));



        grade.Code = code;

        grade.Label = dto.Label?.Trim();

        grade.Value = dto.Value;

        grade.Type = string.IsNullOrWhiteSpace(dto.Type) ? "Hourly" : dto.Type.Trim();

        grade.IsActive = dto.IsActive;

        grade.MinTenureMonths = dto.MinTenureMonths;

        grade.MinWorkedHours = dto.MinWorkedHours;

        grade.RaiseConditionNote = dto.RaiseConditionNote?.Trim();

        grade.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<SalaryGradeDto>.Ok(MapSalaryGrade(grade), "Cập nhật bậc lương thành công."));

    }



    [HttpDelete("salary-grades/{id:int}")]

    [Authorize(Roles = "Admin")]

    public async Task<IActionResult> DeleteSalaryGrade(int id)

    {

        var grade = await _db.SalaryGrades.FindAsync(id);

        if (grade == null) return NotFound(ApiResponse.Fail("Không tìm thấy bậc lương."));

        _db.SalaryGrades.Remove(grade);

        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("Xoá bậc lương thành công."));

    }



    [HttpGet("insurance-rates")]

    public async Task<IActionResult> GetInsuranceRates([FromQuery] bool? activeOnly)

    {

        try
        {
            var q = _db.InsuranceRates.AsQueryable();

            if (activeOnly == true)

                q = q.Where(x => x.IsActive);



            var list = await q.OrderBy(x => x.Code).ToListAsync();

            return Ok(ApiResponse<List<InsuranceRateDto>>.Ok(list.Select(MapInsuranceRate).ToList()));
        }
        catch (Exception)
        {
            return Ok(ApiResponse<List<InsuranceRateDto>>.Ok(new()));
        }

    }



    [HttpPost("insurance-rates")]

    [Authorize(Roles = "Admin")]

    public async Task<IActionResult> CreateInsuranceRate([FromBody] SaveInsuranceRateDto dto)

    {

        if (string.IsNullOrWhiteSpace(dto.Code))

            return BadRequest(ApiResponse.Fail("Mã mức BH không được để trống."));

        if (dto.Amount <= 0)

            return BadRequest(ApiResponse.Fail("Số tiền trừ phải lớn hơn 0."));



        var code = dto.Code.Trim().ToUpperInvariant();

        if (await _db.InsuranceRates.AnyAsync(x => x.Code == code))

            return BadRequest(ApiResponse.Fail($"Mã '{code}' đã tồn tại."));



        var rate = new InsuranceRate

        {

            Code = code,

            Label = dto.Label?.Trim(),

            Amount = dto.Amount,

            IsActive = dto.IsActive,

        };

        _db.InsuranceRates.Add(rate);

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<InsuranceRateDto>.Ok(MapInsuranceRate(rate), "Tạo mức trừ BH thành công."));

    }



    [HttpPut("insurance-rates/{id:int}")]

    [Authorize(Roles = "Admin")]

    public async Task<IActionResult> UpdateInsuranceRate(int id, [FromBody] SaveInsuranceRateDto dto)

    {

        var rate = await _db.InsuranceRates.FindAsync(id);

        if (rate == null) return NotFound(ApiResponse.Fail("Không tìm thấy mức trừ BH."));

        if (string.IsNullOrWhiteSpace(dto.Code))

            return BadRequest(ApiResponse.Fail("Mã mức BH không được để trống."));

        if (dto.Amount <= 0)

            return BadRequest(ApiResponse.Fail("Số tiền trừ phải lớn hơn 0."));



        var code = dto.Code.Trim().ToUpperInvariant();

        if (await _db.InsuranceRates.AnyAsync(x => x.Code == code && x.Id != id))

            return BadRequest(ApiResponse.Fail($"Mã '{code}' đã tồn tại."));



        rate.Code = code;

        rate.Label = dto.Label?.Trim();

        rate.Amount = dto.Amount;

        rate.IsActive = dto.IsActive;

        rate.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<InsuranceRateDto>.Ok(MapInsuranceRate(rate), "Cập nhật thành công."));

    }



    [HttpDelete("insurance-rates/{id:int}")]

    [Authorize(Roles = "Admin")]

    public async Task<IActionResult> DeleteInsuranceRate(int id)

    {

        var rate = await _db.InsuranceRates.FindAsync(id);

        if (rate == null) return NotFound(ApiResponse.Fail("Không tìm thấy mức trừ BH."));

        _db.InsuranceRates.Remove(rate);

        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("Xoá mức trừ BH thành công."));

    }



    private static ShiftTemplateDto MapShiftTemplate(ShiftTemplate t) => new()

    {

        Id = t.Id,

        Name = t.Name,

        StartTime = t.StartTime.ToString("HH:mm"),

        EndTime = t.EndTime.ToString("HH:mm"),

        ColorHex = t.ColorHex,

        SortOrder = t.SortOrder,

        IsActive = t.IsActive,

        CreatedAt = t.CreatedAt.ToString("yyyy-MM-dd"),

    };



    private static SalaryGradeDto MapSalaryGrade(SalaryGrade g) => new()

    {

        Id = g.Id,

        Code = g.Code,

        Label = g.Label,

        Value = g.Value,

        Type = g.Type,

        IsActive = g.IsActive,

        MinTenureMonths = g.MinTenureMonths,

        MinWorkedHours = g.MinWorkedHours,

        RaiseConditionNote = g.RaiseConditionNote,

        CreatedAt = g.CreatedAt.ToString("yyyy-MM-dd"),

    };



    private static InsuranceRateDto MapInsuranceRate(InsuranceRate r) => new()

    {

        Id = r.Id,

        Code = r.Code,

        Label = r.Label,

        Amount = r.Amount,

        IsActive = r.IsActive,

        CreatedAt = r.CreatedAt.ToString("yyyy-MM-dd"),

    };

    private static bool IsSchemaError(Exception ex)
    {
        for (var e = ex; e != null; e = e.InnerException)
        {
            if (e is SqlException sql && (sql.Number == 208 || sql.Number == 207 || sql.Number == 4060))
                return true;
            var msg = e.Message;
            if (msg.Contains("Invalid object name", StringComparison.OrdinalIgnoreCase)
                || msg.Contains("Invalid column name", StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

}


