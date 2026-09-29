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
        public string Period { get; set; }           // today | week | month | year
        public decimal TotalRevenue { get; set; }
        public int TotalOrders { get; set; }
        public decimal AverageOrderValue { get; set; }
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
        public List<VendorOrderItemDto> Items { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }

    public class VendorOrderItemDto
    {
        public Guid ProductId { get; set; }
        public string ProductName { get; set; }
        public string? ProductNameAr { get; set; }
        public string? ProductImageUrl { get; set; }
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; }
        public decimal Subtotal { get; set; }
    }

    // ===================================
    // تأكيد / رفض الطلب
    // ===================================
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