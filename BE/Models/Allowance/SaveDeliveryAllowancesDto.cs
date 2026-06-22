using System.Collections.Generic;

namespace WorkforceManagement.Api.Models.Allowance;

public class SaveDeliveryAllowancesDto
{
	public int Year { get; set; }

	public int Month { get; set; }

	public List<SaveDeliveryAllowanceItemDto> Items { get; set; } = new List<SaveDeliveryAllowanceItemDto>();
}
