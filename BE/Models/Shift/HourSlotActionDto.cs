namespace WorkforceManagement.Api.Models.Shift;

/// <summary>Duyệt/hủy theo NV + cửa hàng + ngày + giờ — không phụ thuộc id trên chip.</summary>
public class HourSlotActionDto
{
    public int EmployeeId { get; set; }
    public int StoreId { get; set; }
    public string WorkDate { get; set; } = "";
    public string StartTime { get; set; } = "";
    public string EndTime { get; set; } = "";
}
