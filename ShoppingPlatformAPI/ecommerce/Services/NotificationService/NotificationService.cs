using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Hubs;
using ecommerce.Repositories;
using ecommerce.Services.PushService;
using Microsoft.AspNetCore.SignalR;
using System.Text.Json;

namespace ecommerce.Services.NotificationService
{
    public class NotificationService : INotificationService
    {
        private readonly IHubContext<NotificationHub> _notificationHub;
        private readonly IHubContext<OpsHub> _opsHub;
        private readonly INotificationRepository _notificationRepository;
        private readonly IUserRepository _userRepository;
        private readonly IVendorRepository _vendorRepository;
        private readonly IProductRepository _productRepository;
        private readonly IUserPreferencesRepository _preferencesRepository;
        private readonly ILogger<NotificationService> _logger;
        private readonly IPushQueue? _push;

        public NotificationService(
            IHubContext<NotificationHub> notificationHub,
            IHubContext<OpsHub> opsHub,
            INotificationRepository notificationRepository,
            IUserRepository userRepository,
            IVendorRepository vendorRepository,
            IProductRepository productRepository,
            IUserPreferencesRepository preferencesRepository,
            ILogger<NotificationService> logger,
            IPushQueue? push = null)
        {
            _push = push;
            _notificationHub = notificationHub;
            _opsHub = opsHub;
            _notificationRepository = notificationRepository;
            _userRepository = userRepository;
            _vendorRepository = vendorRepository;
            _productRepository = productRepository;
            _preferencesRepository = preferencesRepository;
            _logger = logger;
        }

        // فريق العمليات (لحظي) + الأدمن (حسب تفضيلاتهم)
        public async Task NotifyNewOrderAsync(Guid orderId, string orderNumber)
        {
            await _opsHub.Clients.Group("OpsTeam").SendAsync("NewOrder", new
            {
                orderId,
                orderNumber,
                message = $"طلب جديد: {orderNumber}",
                timestamp = DateTime.UtcNow
            });
            _push?.Enqueue(new PushMessage($"طلب جديد: {orderNumber}", Role: UserRoles.Ops,
                Url: $"/operations/orders?order={orderId}", Tag: $"order-{orderId}"));

            await NotifyAdminsAsync(
                NotificationCategory.NewOrders, NotificationType.NEW_ORDER,
                $"طلب جديد: {orderNumber}", new { orderId, orderNumber });

            _logger.LogInformation("New order notification sent. OrderNumber: {OrderNumber}", orderNumber);
        }

        // فريق العمليات + صاحب المتجر
        public async Task NotifyNewSubOrderAsync(Guid subOrderId, string subOrderNumber, Guid vendorId)
        {
            await _opsHub.Clients.Group("OpsTeam").SendAsync("NewSubOrder", new
            {
                subOrderId,
                subOrderNumber,
                message = $"طلب فرعي جديد يحتاج تأكيد: {subOrderNumber}",
                timestamp = DateTime.UtcNow,
                requiresAction = true
            });

            await NotifyVendorAsync(
                vendorId, NotificationCategory.NewOrders, NotificationType.NEW_ORDER,
                $"طلب جديد لمتجرك: {subOrderNumber}", new { subOrderId, subOrderNumber });

            _logger.LogInformation("New sub-order notification sent. SubOrderNumber: {SubOrderNumber}", subOrderNumber);
        }

        // فريق العمليات + صاحب المتجر
        public async Task NotifySubOrderConfirmedAsync(Guid subOrderId, string subOrderNumber, Guid vendorId)
        {
            await _opsHub.Clients.Group("OpsTeam").SendAsync("SubOrderConfirmed", new
            {
                subOrderId,
                subOrderNumber,
                message = $"تم تأكيد الطلب الفرعي: {subOrderNumber}",
                timestamp = DateTime.UtcNow
            });

            await NotifyVendorAsync(
                vendorId, NotificationCategory.OrderConfirmations, NotificationType.SUB_ORDER,
                $"تم تأكيد الطلب {subOrderNumber}", new { subOrderId, subOrderNumber });

            _logger.LogInformation("Sub-order confirmed notification sent. SubOrderNumber: {SubOrderNumber}", subOrderNumber);
        }

        // فريق العمليات + صاحب المتجر
        public async Task NotifySubOrderCancelledAsync(Guid subOrderId, string subOrderNumber, string reason, Guid vendorId)
        {
            await _opsHub.Clients.Group("OpsTeam").SendAsync("SubOrderCancelled", new
            {
                subOrderId,
                subOrderNumber,
                reason,
                message = $"تم إلغاء الطلب الفرعي: {subOrderNumber}",
                timestamp = DateTime.UtcNow
            });

            await NotifyVendorAsync(
                vendorId, NotificationCategory.OrderConfirmations, NotificationType.SUB_ORDER,
                $"تم إلغاء الطلب {subOrderNumber}: {reason}", new { subOrderId, subOrderNumber, reason });

            _logger.LogInformation("Sub-order cancelled notification sent. SubOrderNumber: {SubOrderNumber}", subOrderNumber);
        }

        public async Task NotifySubOrderStatusChangedAsync(Guid subOrderId, string subOrderNumber, Guid orderId, string newStatus, bool pushToOps = true)
        {
            var message = OrderStatusText.StaffMessage(newStatus, subOrderNumber);
            await _opsHub.Clients.Group("OpsTeam").SendAsync("SubOrderStatusChanged", new
            {
                subOrderId,
                subOrderNumber,
                orderId,
                newStatus,
                message,
                timestamp = DateTime.UtcNow
            });

            // «جاهز للاستلام» يحتاج تحركاً فورياً من العمليات (تعيين سائق)
            if (pushToOps && newStatus == OrderStatus.READY)
                _push?.Enqueue(new PushMessage(message, Role: UserRoles.Ops,
                    Url: $"/operations/orders?order={orderId}", Tag: $"order-{orderId}"));
        }

        public async Task NotifyOrderStatusChangedAsync(Guid orderId, string oldStatus, string newStatus, string? orderNumber = null)
        {
            await _opsHub.Clients.Group("OpsTeam").SendAsync("OrderStatusChanged", new
            {
                orderId,
                oldStatus,
                newStatus,
                message = OrderStatusText.StaffMessage(newStatus, orderNumber ?? ""),
                timestamp = DateTime.UtcNow
            });

            _logger.LogInformation("Order status changed. OrderId: {OrderId}, From: {OldStatus}, To: {NewStatus}",
                orderId, oldStatus, newStatus);
        }

        // كل إشعارات الزبون الحالية متعلقة بطلباته
        public async Task NotifyCustomerAsync(Guid customerId, string message, object? data = null)
        {
            await SendToUserAsync(
                customerId, NotificationCategory.OrderUpdates, NotificationType.GENERAL, message, data);
        }

        public async Task NotifyCustomerOrderStatusAsync(
            Guid customerId, Guid orderId, string orderNumber, string newStatus)
        {
            if (!await IsEnabledAsync(customerId, NotificationCategory.OrderUpdates)) return;
            // «مؤكد جزئياً» حالة عابرة (متجر أكّد وآخر لم يرد بعد) — الزبون يُبلَّغ حين يكتمل التأكيد
            if (newStatus == OrderStatus.PARTIALLY_CONFIRMED) return;

            var message = OrderStatusText.CustomerMessage(newStatus, orderNumber);
            var data = new { orderId, orderNumber, status = newStatus };

            var notification = new Notification
            {
                UserId = customerId,
                Type = NotificationType.ORDER_STATUS,
                Message = message,
                Data = JsonSerializer.Serialize(data)
            };

            await _notificationRepository.CreateAsync(notification);
            _push?.Enqueue(new PushMessage(message, UserId: customerId, NotificationId: notification.Id, Tag: $"order-{orderId}"));

            await _notificationHub.Clients.User(customerId.ToString()).SendAsync("OrderStatusChanged", new
            {
                id = notification.Id,
                orderId,
                orderNumber,
                newStatus,
                message,
                timestamp = DateTime.UtcNow
            });
        }

        // إشعار صاحب المتجر (إن وُجد له حساب مرتبط) — فشله لا يُفشل العملية التي أطلقته
        public async Task NotifyVendorAsync(
            Guid vendorId, NotificationCategory category, string type, string message, object? data = null)
        {
            try
            {
                var vendor = await _vendorRepository.GetByIdAsync(vendorId);
                if (vendor?.OwnerId == null) return;

                await SendToUserAsync(vendor.OwnerId.Value, category, type, message, data);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Vendor notification failed. VendorId: {VendorId}, Category: {Category}",
                    vendorId, category);
            }
        }

        // كل مستخدمي الأدمن الذين فعّلوا هذه الفئة — فشله لا يُفشل العملية التي أطلقته
        public async Task NotifyAdminsAsync(
            NotificationCategory category, string type, string message, object? data = null)
        {
            try
            {
                var admins = (await _userRepository.GetByRoleAsync(UserRoles.Admin)).ToList();
                if (admins.Count == 0) return;

                var preferences = (await _preferencesRepository.GetByUserIdsAsync(admins.Select(a => a.Id)))
                    .ToDictionary(p => p.UserId);

                foreach (var admin in admins)
                {
                    var enabled = preferences.TryGetValue(admin.Id, out var p)
                        ? p.IsEnabled(category)
                        : new UserPreferences().IsEnabled(category);

                    if (enabled)
                        await PersistAndPushAsync(admin.Id, type, message, data);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Admin notification failed. Category: {Category}", category);
            }
        }

        // صاحب المتجر + الأدمن
        public async Task NotifyLowStockAsync(Guid productId, string productName, Guid vendorId, int stockQuantity)
        {
            var message = stockQuantity == 0
                ? $"نفد مخزون المنتج: {productName}"
                : $"مخزون منخفض ({stockQuantity}) للمنتج: {productName}";
            var data = new { productId, vendorId, stockQuantity };

            await NotifyVendorAsync(vendorId, NotificationCategory.LowStock, NotificationType.LOW_STOCK, message, data);
            await NotifyAdminsAsync(NotificationCategory.LowStock, NotificationType.LOW_STOCK, message, data);
        }

        // صاحب المتجر: تقييم جديد على أحد منتجاته
        public async Task NotifyNewReviewAsync(Guid productId, Guid reviewId, int rating)
        {
            try
            {
                var product = await _productRepository.GetByIdAsync(productId);
                if (product == null) return;

                await NotifyVendorAsync(
                    product.VendorId, NotificationCategory.Reviews, NotificationType.REVIEW,
                    $"تقييم جديد ({rating}/5) على منتج: {product.NameAr ?? product.Name}",
                    new { productId, reviewId, rating });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Review notification failed. ProductId: {ProductId}", productId);
            }
        }

        public async Task NotifyDriverUpdatedAsync(Guid driverId, string workStatus, string? reason = null)
        {
            try
            {
                await _opsHub.Clients.Group("OpsTeam").SendAsync("DriverUpdated", new
                {
                    driverId,
                    workStatus,
                    reason,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "DriverUpdated broadcast failed");
            }
        }

        // من لا يملك سجل تفضيلات تُطبَّق عليه القيم الافتراضية
        private async Task<bool> IsEnabledAsync(Guid userId, NotificationCategory category)
        {
            var preferences = await _preferencesRepository.GetByUserIdAsync(userId) ?? new UserPreferences();
            return preferences.IsEnabled(category);
        }

        private async Task SendToUserAsync(
            Guid userId, NotificationCategory category, string type, string message, object? data)
        {
            if (!await IsEnabledAsync(userId, category)) return;
            await PersistAndPushAsync(userId, type, message, data);
        }

        // يُحفظ في قاعدة البيانات ثم يُرسل لحظياً إذا كان المستخدم متصلاً
        private async Task PersistAndPushAsync(Guid userId, string type, string message, object? data)
        {
            var notification = new Notification
            {
                UserId = userId,
                Type = type,
                Message = message,
                Data = data != null ? JsonSerializer.Serialize(data) : null
            };

            await _notificationRepository.CreateAsync(notification);
            _push?.Enqueue(new PushMessage(message, UserId: userId, NotificationId: notification.Id));

            await _notificationHub.Clients.User(userId.ToString()).SendAsync("Notification", new
            {
                id = notification.Id,
                type,
                message,
                data,
                timestamp = DateTime.UtcNow
            });
        }
    }
}
