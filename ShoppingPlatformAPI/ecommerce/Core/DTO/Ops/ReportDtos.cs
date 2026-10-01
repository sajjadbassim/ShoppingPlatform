namespace ecommerce.Core.DTO.Ops
{
    // تقرير العمليات لفترة (التواريخ بتوقيت العراق)
    public class OpsReportDto
    {
        public DateOnly From { get; set; }
        public DateOnly To { get; set; }
        public OpsReportSummaryDto Summary { get; set; } = new();
        public OpsReportSummaryDto PreviousSummary { get; set; } = new();   // الفترة السابقة بنفس الطول — للمقارنة
        public List<OpsReportDayDto> Daily { get; set; } = new();
        public int[] Hourly { get; set; } = new int[24];                     // عدد الطلبات حسب ساعة اليوم
        public List<OpsReportVendorDto> Vendors { get; set; } = new();
        public List<OpsReportDriverDto> Drivers { get; set; } = new();
        public List<OpsReportReasonDto> CancellationReasons { get; set; } = new();
        public List<OpsReportSlowOrderDto> SlowestOrders { get; set; } = new();   // أبطأ الطلبات المُسلَّمة في الفترة
        public int DeliveryFastMinutes { get; set; }
        public int DeliverySlowMinutes { get; set; }
    }

    public class OpsReportSlowOrderDto
    {
        public Guid OrderId { get; set; }
        public string OrderNumber { get; set; } = "";
        public double TotalMinutes { get; set; }
        public string? Speed { get; set; }
        public string? SlowestStage { get; set; }
        public double? SlowestStageMinutes { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class OpsReportSummaryDto
    {
        public int Orders { get; set; }                 // طلبات رئيسية
        public int StoreOrders { get; set; }            // طلبات فرعية (لكل متجر)
        public int Delivered { get; set; }              // طلبات فرعية مُسلّمة
        public int Cancelled { get; set; }
        public double CancellationRate { get; set; }    // 0..1
        public decimal Revenue { get; set; }            // قيمة المُسلّم (منتجات + توصيل)
        public decimal AverageOrderValue { get; set; }
        public double? AvgConfirmMinutes { get; set; }  // من الطلب حتى تأكيد المتجر
        public double? AvgDeliveryMinutes { get; set; } // من الطلب حتى التسليم
        public double? AvgRideMinutes { get; set; }     // من خروج السائق حتى التسليم
    }

    public class OpsReportDayDto
    {
        public DateOnly Date { get; set; }
        public int Orders { get; set; }
        public int Delivered { get; set; }
        public int Cancelled { get; set; }
        public decimal Revenue { get; set; }
    }

    public class OpsReportVendorDto
    {
        public Guid VendorId { get; set; }
        public string Name { get; set; } = "";
        public int Orders { get; set; }
        public int Delivered { get; set; }
        public int Cancelled { get; set; }
        public decimal Revenue { get; set; }
        public double? AvgConfirmMinutes { get; set; }
    }

    public class OpsReportDriverDto
    {
        public Guid DriverId { get; set; }
        public string Name { get; set; } = "";
        public int Deliveries { get; set; }
        public double? AvgRideMinutes { get; set; }
    }

    public class OpsReportReasonDto
    {
        public string Reason { get; set; } = "";
        public int Count { get; set; }
    }
}
