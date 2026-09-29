using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Order
{
    // ===================================
    // Tracking DTO - Timeline الطلب
    // ===================================
    public class OrderTrackingDto
    {
        public Guid OrderId { get; set; }
        public string OrderNumber { get; set; }
        public string CurrentStatus { get; set; }
        public DateTime? EstimatedDelivery { get; set; }
        public List<TrackingTimelineDto> Timeline { get; set; } = new List<TrackingTimelineDto>();
        public List<SubOrderTrackingDto> SubOrders { get; set; } = new List<SubOrderTrackingDto>();
    }

    public class TrackingTimelineDto
    {
        public string Status { get; set; }
        public string StatusAr { get; set; }
        public string Description { get; set; }
        public DateTime? OccurredAt { get; set; }
        public bool IsCompleted { get; set; }
        public bool IsCurrent { get; set; }
    }

    public class SubOrderTrackingDto
    {
        public Guid SubOrderId { get; set; }
        public string SubOrderNumber { get; set; }
        public string VendorName { get; set; }
        public string Status { get; set; }
        public DriverTrackingDto? Driver { get; set; }
        public List<TrackingTimelineDto> Timeline { get; set; } = new List<TrackingTimelineDto>();
    }

    public class DriverTrackingDto
    {
        public Guid DriverId { get; set; }
        public string DriverName { get; set; }
        public string DriverPhone { get; set; }
        public string? VehicleType { get; set; }
    }

    // ===================================
    // Cancel DTO - إلغاء الطلب
    // ===================================
    public class CancelOrderDto
    {
        [Required(ErrorMessage = "سبب الإلغاء مطلوب")]
        [MaxLength(500)]
        public string Reason { get; set; }
    }
}

namespace ecommerce.Core.DTO.Return
{
    // ===================================
    // Create Return DTO
    // ===================================
    public class CreateReturnDto
    {
        [Required(ErrorMessage = "رقم الطلب مطلوب")]
        public Guid OrderId { get; set; }

        [Required(ErrorMessage = "سبب الإرجاع مطلوب")]
        public string Reason { get; set; } // defective | wrong_item | not_as_described | changed_mind | other

        [MaxLength(1000, ErrorMessage = "التفاصيل لا تتجاوز 1000 حرف")]
        public string? Details { get; set; }

        [Required(ErrorMessage = "يجب تحديد المنتجات المراد إرجاعها")]
        public List<ReturnItemDto> Items { get; set; }

        public List<IFormFile>? Images { get; set; } // صور توضح المشكلة
    }

    public class ReturnItemDto
    {
        [Required]
        public Guid ProductId { get; set; }

        // يحدد المتغير المُرجَع عندما يحتوي الطلب على أكثر من متغير لنفس المنتج
        public Guid? VariantId { get; set; }

        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "الكمية يجب أن تكون أكبر من 0")]
        public int Quantity { get; set; }
    }

    // ===================================
    // Review Return DTO (Admin/Ops)
    // ===================================
    public class ReviewReturnDto
    {
        [Required(ErrorMessage = "القرار مطلوب")]
        public string Decision { get; set; } // approved | rejected

        [MaxLength(500)]
        public string? RejectionReason { get; set; } // مطلوب فقط عند الرفض
    }

    // ===================================
    // Response DTOs
    // ===================================
    public class ReturnResponseDto
    {
        public Guid Id { get; set; }
        public string ReturnNumber { get; set; }
        public Guid OrderId { get; set; }
        public string OrderNumber { get; set; }
        public string Status { get; set; }
        public string StatusAr { get; set; }
        public string Reason { get; set; }
        public string ReasonAr { get; set; }
        public string? Details { get; set; }
        public string? RejectionReason { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? CustomerName { get; set; }
        public string? CustomerPhone { get; set; }
        public bool IsRestocked { get; set; }
        public DateTime? RestockedAt { get; set; }
        public List<ReturnItemResponseDto> Items { get; set; } = new();
        public List<string> Images { get; set; } = new();
    }

    public class ReturnItemResponseDto
    {
        public Guid ProductId { get; set; }
        public Guid? VariantId { get; set; }
        public string ProductName { get; set; }
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal TotalPrice => Quantity * UnitPrice;
    }
}