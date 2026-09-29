// Core/DTO/Ops/DriverStatsDto.cs
namespace ecommerce.Core.DTO.Ops
{
    public class DriverStatsDto
    {
        public Guid DriverId { get; set; }
        public string DriverName { get; set; }

        // إجمالي
        public int TotalDeliveries { get; set; }
        public int TotalCancelled { get; set; }
        public decimal SuccessRate { get; set; }

        // اليوم
        public int DeliveriesToday { get; set; }
        public int CancelledToday { get; set; }

        // الأسبوع
        public int DeliveriesThisWeek { get; set; }

        // الشهر
        public int DeliveriesThisMonth { get; set; }

        // التقييم
        public decimal Rating { get; set; }

        // الحالة الحالية
        public string WorkStatus { get; set; }
        public int ActiveOrders { get; set; }
    }
}