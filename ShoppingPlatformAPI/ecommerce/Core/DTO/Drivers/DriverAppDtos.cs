using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Drivers
{
    // ===== لوحة السائق =====

    public class DriverProfileDto
    {
        public Guid DriverId { get; set; }
        public string FullName { get; set; }
        public string Phone { get; set; }
        public string VehicleType { get; set; }
        public string WorkStatus { get; set; }
        public decimal Rating { get; set; }
        public int TotalDeliveries { get; set; }
        public int DeliveredToday { get; set; }
        public int ActiveOrders { get; set; }
        public decimal CashInHand { get; set; }      // نقد استلمه ولم يسلّمه للعمليات بعد
        public DateTime? LastLocationAt { get; set; }
    }

    // طلب واحد كما يراه السائق (قد يجمع أكثر من متجر)
    public class DriverOrderDto
    {
        public Guid OrderId { get; set; }
        public string OrderNumber { get; set; }
        public string Status { get; set; }           // حالة جزء السائق: OUT_FOR_DELIVERY أو DELIVERED
        public string CustomerName { get; set; }
        public string? CustomerPhone { get; set; }
        public string Address { get; set; }
        public string? AddressDetails { get; set; }  // بناية/طابق/شقة
        public string? AddressNotes { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public string? CustomerNotes { get; set; }
        public string PaymentMethod { get; set; }
        public string PaymentStatus { get; set; }
        public decimal AmountToCollect { get; set; } // 0 إن كان مدفوعاً
        public decimal DeliveryFee { get; set; }      // أجرة التوصيل ضمن المبلغ (لحساب الرفض)
        public string RefusalFeePayer { get; set; } = "CUSTOMER"; // من يتحمّل الأجرة عند الرفض الكامل
        public string PartialRefusalFeePayer { get; set; } = "CUSTOMER"; // ... وعند الرفض الجزئي
        public decimal? CashCollectedAmount { get; set; }
        public DateTime AssignedAt { get; set; }
        public DateTime? DeliveredAt { get; set; }
        public List<DriverStopDto> Stores { get; set; } = new();
    }

    public class DriverStopDto
    {
        public Guid SubOrderId { get; set; }
        public string SubOrderNumber { get; set; }
        public string VendorName { get; set; }
        public string? VendorPhone { get; set; }
        public string? VendorAddress { get; set; }
        public int ItemsCount { get; set; }
        public string Status { get; set; }
        public DateTime? PickedUpAt { get; set; }
        public List<DriverItemDto> Items { get; set; } = new();
    }

    public class DriverItemDto
    {
        public Guid SubOrderItemId { get; set; }
        public string Name { get; set; }
        public string? Variant { get; set; }
        public string? ImageUrl { get; set; }
        public int Quantity { get; set; }
        public int RefusedQuantity { get; set; }
        public decimal UnitPrice { get; set; }
    }

    public class DriverWorkStatusDto
    {
        [Required]
        public string WorkStatus { get; set; }       // available | break | offline
    }

    public class DriverDeliverDto
    {
        // لطلبات الدفع عند الاستلام: السائق يؤكد استلام المبلغ
        public bool CashCollected { get; set; }

        // رفض جزئي عند الباب: القطع التي رجعت مع السائق
        public List<DriverRefusedItemDto> RefusedItems { get; set; } = new();
        public string? RefusalReason { get; set; }   // defective | wrong_item | not_as_described | changed_mind | other
        public string? RefusalNote { get; set; }
    }

    // تعذّر التسليم (رفض كامل/لا يرد/عنوان خاطئ)
    public class DriverFailDto
    {
        [Required]
        public string Reason { get; set; }           // customer_refused | no_answer | wrong_address | other
        [MaxLength(300)]
        public string? Note { get; set; }
        // الزبون رفض لكن دفع أجرة التوصيل (حين يتحمّلها الزبون)
        public bool FeeCollected { get; set; }
    }

    public class DeliverySettingsDto
    {
        [Required]
        public string RefusalFeePayer { get; set; }  // CUSTOMER | VENDOR | NONE
        public bool? PartialRefusalCustomerPays { get; set; }   // null = بلا تغيير
        public DateTime? UpdatedAt { get; set; }
    }

    public class DriverRefusedItemDto
    {
        public Guid SubOrderItemId { get; set; }
        [Range(1, 1000)]
        public int Quantity { get; set; }
    }

    // ===== إدارة الحساب والنقد (للعمليات) =====

    public class DriverAccountDto
    {
        [Required(ErrorMessage = "كلمة المرور مطلوبة")]
        [MinLength(6, ErrorMessage = "كلمة المرور 6 أحرف على الأقل")]
        public string Password { get; set; }
    }

    public class DriverCashDto
    {
        public decimal Total { get; set; }
        public List<DriverCashItemDto> Items { get; set; } = new();
    }

    public class DriverCashItemDto
    {
        public Guid OrderId { get; set; }
        public string OrderNumber { get; set; }
        public decimal Amount { get; set; }
        public DateTime CollectedAt { get; set; }
    }
}
