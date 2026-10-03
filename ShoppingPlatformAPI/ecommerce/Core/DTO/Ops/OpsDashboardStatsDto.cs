// Core/DTO/Ops/OpsDashboardStatsDto.cs
namespace ecommerce.Core.DTO.Ops
{
    public class OpsDashboardStatsDto
    {
        public int PendingConfirmation { get; set; }
        public int Confirmed { get; set; }
        public int PartiallyConfirmed { get; set; }
        public int Preparing { get; set; }
        public int Ready { get; set; }          // جاهز للاستلام — يحتاج سائقاً
        public int OutForDelivery { get; set; }
        public int Delivered { get; set; }
        public int Cancelled { get; set; }
        public int TotalToday { get; set; }
    }
}