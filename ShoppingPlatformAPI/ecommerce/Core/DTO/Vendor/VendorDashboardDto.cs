namespace ecommerce.Core.DTO.Vendor
{
    // ===================================
    // إحصائيات البائع الرئيسية
    // ===================================
    public class VendorDashboardDto
    {
        public Guid VendorId { get; set; }
        public string VendorName { get; set; }
        public string? LogoUrl { get; set; }

        // ===================================
        // إحصائيات الطلبات
        // ===================================
        public int TotalOrders { get; set; }
        public int PendingOrders { get; set; }       // بانتظار التأكيد
        public int ActiveOrders { get; set; }        // قيد التحضير / التوصيل
        public int CompletedOrders { get; set; }     // مكتملة
        public int CancelledOrders { get; set; }     // ملغاة

        // ===================================
        // إحصائيات المبيعات
        // ===================================
        public decimal TotalRevenue { get; set; }
        public decimal RevenueToday { get; set; }
        public decimal RevenueThisWeek { get; set; }
        public decimal RevenueThisMonth { get; set; }

        // ===================================
        // إحصائيات المنتجات
        // ===================================
        public int TotalProducts { get; set; }
        public int ActiveProducts { get; set; }
        public int OutOfStockProducts { get; set; }
        public int LowStockProducts { get; set; }   // أقل من 10

        // ===================================
        // إحصائيات التقييمات
        // ===================================
        public decimal? AverageRating { get; set; }
        public int TotalReviews { get; set; }
        public int PendingReviews { get; set; }      // بانتظار الموافقة

        // ===================================
        // أحدث 5 طلبات
        // ===================================
        public List<VendorRecentOrderDto> RecentOrders { get; set; } = new();

        // ===================================
        // أكثر 5 منتجات مبيعاً
        // ===================================
        public List<VendorTopProductDto> TopProducts { get; set; } = new();
    }

    // ===================================
    // طلب حديث في الداشبورد
    // ===================================
    public class VendorRecentOrderDto
    {
        public Guid SubOrderId { get; set; }
        public string SubOrderNumber { get; set; }
        public string CustomerName { get; set; }
        public decimal Subtotal { get; set; }
        public string Status { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // ===================================
    // منتج الأكثر مبيعاً
    // ===================================
    public class VendorTopProductDto
    {
        public Guid ProductId { get; set; }
        public string ProductName { get; set; }
        public string? ProductNameAr { get; set; }
        public string? ImageUrl { get; set; }
        public int TotalSold { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
    }

    // ===================================
    // إحصائيات المبيعات بالفترة
    // ===================================
    public class VendorSalesStatsDto
    {
        public string Period { get; set; }           // today | week | month | year | custom
        public DateTime From { get; set; }           // أيام بغداد (شاملة)
        public DateTime To { get; set; }
        public decimal TotalRevenue { get; set; }
        public int TotalOrders { get; set; }
        public decimal AverageOrderValue { get; set; }
        // الفترة السابقة بنفس عدد الأيام — للمقارنة
        public decimal PreviousRevenue { get; set; }
        public int PreviousOrders { get; set; }
        public List<VendorSalesByDayDto> SalesByDay { get; set; } = new();
    }

    public class VendorSalesByDayDto
    {
        public DateTime Date { get; set; }
        public decimal Revenue { get; set; }
        public int OrderCount { get; set; }
    }

    // ===================================
    // طلبات البائع (مفصلة)
    // ===================================
    public class VendorOrderDto
    {
        public Guid SubOrderId { get; set; }
        public Guid OrderId { get; set; }
        public string SubOrderNumber { get; set; }
        public string OrderNumber { get; set; }
        public string CustomerName { get; set; }
        public string CustomerPhone { get; set; }
        public string DeliveryAddress { get; set; }
        public decimal Subtotal { get; set; }
        public decimal DeliveryFee { get; set; }
        public string Status { get; set; }
        public string? CancellationReason { get; set; }
        public DateTime? ConfirmationDeadline { get; set; }
        public int? MinutesRemaining { get; set; }
        public string? CustomerNotes { get; set; }
        public DateTime? DeliverySlotStart { get; set; }
        public DateTime? DeliverySlotEnd { get; set; }
        public string? SubstitutionPreference { get; set; }
        public List<VendorOrderItemDto> Items { get; set; } = new();
        // إرجاعات الزبون التي تخص قطع هذا المتجر
        public List<VendorOrderReturnDto> Returns { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }

    public class VendorOrderItemDto
    {
        public Guid Id { get; set; }
        public Guid ProductId { get; set; }
        public string ProductName { get; set; }
        public string? ProductNameAr { get; set; }
        public string? ProductImageUrl { get; set; }
        // المتغير الذي اختاره الزبون — بدونه لا يعرف التاجر أي مقاس/لون يجهّز
        public Guid? VariantId { get; set; }
        public string? VariantSku { get; set; }
        public string? VariantLabel { get; set; }
        public int RefusedQuantity { get; set; }       // رفضها الزبون عند الباب
        public int ReturnedQuantity { get; set; }      // أُرجعت بعد الاستلام (إرجاع معتمد)
        public int UnavailableQuantity { get; set; }   // أزالها المتجر عند القبول الجزئي
        public decimal? WeightStepKg { get; set; }
        public Guid? ReplacesItemId { get; set; }      // بديل اختاره المتجر عن قطعة غير متوفرة
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; }
        public decimal Subtotal { get; set; }
    }

    // ===================================
    // تأكيد / رفض الطلب
    // ===================================
    public class VendorOrderReturnDto
    {
        public Guid Id { get; set; }
        public string ReturnNumber { get; set; } = "";
        public string Status { get; set; } = "";
        public string Reason { get; set; } = "";
        public string? Details { get; set; }
        public bool IsDoorRefusal { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<VendorOrderReturnItemDto> Items { get; set; } = new();
    }

    public class VendorOrderReturnItemDto
    {
        public string ProductName { get; set; } = "";
        public int Quantity { get; set; }
    }

    // القبول الجزئي: القطع غير المتوفرة (تُزال من الطلب ويُعاد مخزونها)
    public class VendorConfirmDto
    {
        public List<UnavailableItemDto>? UnavailableItems { get; set; }
    }

    public class UnavailableItemDto
    {
        public Guid ItemId { get; set; }
        public int Quantity { get; set; }
        // إن اختار الزبون «استبدله بمشابه»: منتج من نفس المتجر بنفس الكمية، ولا يدفع الزبون أكثر من سعر الأصلي
        public Guid? ReplacementProductId { get; set; }
    }

    public class VendorReviewFeedDto
    {
        public Guid Id { get; set; }
        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = "";
        public string? ProductImageUrl { get; set; }
        public string? CustomerName { get; set; }
        public int Rating { get; set; }
        public string? Title { get; set; }
        public string? Body { get; set; }
        public bool IsVerifiedPurchase { get; set; }
        public List<string> Images { get; set; } = new();
        public string? VendorReply { get; set; }
        public DateTime? VendorReplyAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class VendorProductSalesDto
    {
        public Guid ProductId { get; set; }
        public int Sold { get; set; }
        public decimal Revenue { get; set; }
    }

    public class VendorOrderCountsDto
    {
        public int Total { get; set; }
        public Dictionary<string, int> ByStatus { get; set; } = new();
        public decimal PendingValue { get; set; }
    }

    public class ConfirmSubOrderDto
    {
        public Guid OpsUserId { get; set; }
    }

    public class RejectSubOrderDto
    {
        public Guid OpsUserId { get; set; }
        public string Reason { get; set; }
    }

    // ===================================
    // منتجات البائع (مع إحصائيات المبيعات)
    // ===================================
    public class VendorProductStatsDto
    {
        public Guid ProductId { get; set; }
        public string Name { get; set; }
        public string? NameAr { get; set; }
        public string? ImageUrl { get; set; }
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
        public bool IsAvailable { get; set; }
        public bool IsActive { get; set; }
        public int TotalSold { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal? AverageRating { get; set; }
        public int ReviewCount { get; set; }
    }
}