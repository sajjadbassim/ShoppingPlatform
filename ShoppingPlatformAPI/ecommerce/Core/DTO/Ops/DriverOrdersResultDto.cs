// Core/DTO/Ops/DriverOrdersResultDto.cs
namespace ecommerce.Core.DTO.Ops
{
    public class DriverOrdersResultDto
    {
        public List<PendingSubOrderDto> Items { get; set; }
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    }
}