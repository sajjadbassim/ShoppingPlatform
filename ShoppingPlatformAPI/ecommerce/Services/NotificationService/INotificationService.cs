using ecommerce.Core.Constants;

namespace ecommerce.Services.NotificationService
{
    // كل إشعار يُحفظ لمستخدم يمرّ على تفضيلاته (UserPreferences) أولاً،
    // أما بث فريق العمليات عبر OpsHub فيبقى كما هو دون فلترة.
    // إشعارات البائع والأدمن لا ترمي استثناءات: فشلها يُسجَّل ولا يُفشل العملية التي أطلقتها.
    public interface INotificationService
    {
        // الطلبات
        Task NotifyNewOrderAsync(Guid orderId, string orderNumber);
        Task NotifyNewSubOrderAsync(Guid subOrderId, string subOrderNumber, Guid vendorId);
        Task NotifySubOrderConfirmedAsync(Guid subOrderId, string subOrderNumber, Guid vendorId);
        Task NotifySubOrderCancelledAsync(Guid subOrderId, string subOrderNumber, string reason, Guid vendorId);
        // تغيّر حالة طلب فرعي (تحضير/جاهز...) — تحديث شاشات العمليات، وإشعار هواتفهم عند «جاهز للاستلام»
        Task NotifySubOrderStatusChangedAsync(Guid subOrderId, string subOrderNumber, Guid orderId, string newStatus, bool pushToOps = true);
        Task NotifyOrderStatusChangedAsync(Guid orderId, string oldStatus, string newStatus, string? orderNumber = null);

        // تحديث لحظي لشاشات العمليات: تغيّرت حالة سائق أو طلباته (استلام/تسليم)
        Task NotifyDriverUpdatedAsync(Guid driverId, string workStatus, string? reason = null);

        // الزبون
        Task NotifyCustomerAsync(Guid customerId, string message, object? data = null);
        Task NotifyCustomerOrderStatusAsync(Guid customerId, Guid orderId, string orderNumber, string newStatus);

        // البائع
        Task NotifyVendorAsync(Guid vendorId, NotificationCategory category, string type, string message, object? data = null);
        Task NotifyNewReviewAsync(Guid productId, Guid reviewId, int rating);

        // الأدمن
        Task NotifyAdminsAsync(NotificationCategory category, string type, string message, object? data = null);

        // المخزون (البائع + الأدمن)
        Task NotifyLowStockAsync(Guid productId, string productName, Guid vendorId, int stockQuantity);
    }
}
