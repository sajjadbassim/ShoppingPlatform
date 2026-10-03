using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Ops
{
    // ===================================
    // رابط مشاركة الموقع للسائق
    // ===================================
    public class DriverTrackingLinkDto
    {
        // يُعرض مرة واحدة عند الإنشاء — الخادم يحفظ بصمته فقط
        public string Token { get; set; } = "";
    }

    public class DriverTrackingInfoDto
    {
        public string DriverName { get; set; } = "";
        public DateTime? LastLocationAt { get; set; }
    }

    public class DriverLocationUpdateDto
    {
        [Range(-90, 90)]
        public double Latitude { get; set; }

        [Range(-180, 180)]
        public double Longitude { get; set; }

        [Range(0, 100000)]
        public double? Accuracy { get; set; }
    }

    // يُبث لغرفة العمليات عبر OpsHub عند كل تحديث
    public class DriverLocationDto
    {
        public Guid DriverId { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public double? Accuracy { get; set; }
        public DateTime At { get; set; }
    }

    // ===================================
    // لوحة التتبع للعمليات
    // ===================================
    public class TrackingBoardDto
    {
        public List<TrackingDriverDto> Drivers { get; set; } = new();
        public List<TrackingDeliveryDto> Deliveries { get; set; } = new();
    }

    public class TrackingDriverDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = "";
        public string Phone { get; set; } = "";
        public string VehicleType { get; set; } = "";
        public string WorkStatus { get; set; } = "";
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public double? Accuracy { get; set; }
        public DateTime? LastLocationAt { get; set; }
        public bool HasTrackingLink { get; set; }
        public int ActiveDeliveries { get; set; }
    }

    // طلب رئيسي نشط (قيد التجهيز أو في الطريق)
    public class TrackingDeliveryDto
    {
        public Guid OrderId { get; set; }
        public string OrderNumber { get; set; } = "";
        public string Stage { get; set; } = "";              // WAITING_STORES | READY_FOR_DRIVER | OUT_FOR_DELIVERY
        public string? CustomerName { get; set; }
        public string? CustomerPhone { get; set; }
        public string? Address { get; set; }
        public string? ZoneName { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public List<string> Stores { get; set; } = new();
        public Guid? DriverId { get; set; }
        public string? DriverName { get; set; }
        public decimal Total { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? StageSince { get; set; }            // منذ متى في المرحلة الحالية
    }
}
