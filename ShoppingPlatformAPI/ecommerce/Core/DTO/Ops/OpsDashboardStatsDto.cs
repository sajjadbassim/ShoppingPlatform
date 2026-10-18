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
        public int AwaitingPickup { get; set; } // معيَّن لسائق ولم يستلمه من المتجر بعد
        public int OutForDelivery { get; set; } // استلمه السائق وهو في الطريق
        public int DeliveryFailed { get; set; }   // تعذّر التسليم — بانتظار قرار العمليات
        public int StaleDeliveries { get; set; }  // مع السائق منذ أكثر من 3 ساعات
        public int OpenReturnTrips { get; set; }  // بضاعة مرتجعة مع السائقين لم تصل متاجرها
        public int Delivered { get; set; }
        public int Cancelled { get; set; }
        public int TotalToday { get; set; }
    }
}