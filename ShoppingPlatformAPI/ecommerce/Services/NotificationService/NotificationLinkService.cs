using ecommerce.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace ecommerce.Services.NotificationService
{
    // وجهة الإشعار عند الضغط عليه: صفحة الطلب (أو الإرجاع/التقييم) المناسبة لدور المستخدم.
    // يُحسب في الخادم لأن الإشعارات القديمة تحمل أحياناً رقم الطلب الفرعي فقط، ولأن الوصول يُتحقق منه هنا.
    public interface INotificationLinkService
    {
        // null = لا وجهة (إشعار عام، أو عنصر لا يخص المستخدم)
        Task<string?> GetLinkAsync(Guid notificationId, Guid userId, string role, CancellationToken ct = default);
    }

    public class NotificationLinkService : INotificationLinkService
    {
        private readonly AppDbContext _context;

        public NotificationLinkService(AppDbContext context) => _context = context;

        public async Task<string?> GetLinkAsync(Guid notificationId, Guid userId, string role, CancellationToken ct = default)
        {
            var data = await _context.Notifications
                .Where(n => n.Id == notificationId && n.UserId == userId)
                .Select(n => n.Data)
                .FirstOrDefaultAsync(ct);
            if (string.IsNullOrWhiteSpace(data)) return null;

            Dictionary<string, JsonElement>? fields;
            try { fields = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(data); }
            catch (JsonException) { return null; }
            if (fields == null) return null;

            Guid? Read(string key) =>
                fields.TryGetValue(key, out var v) && v.ValueKind == JsonValueKind.String && Guid.TryParse(v.GetString(), out var g) ? g : null;

            var orderId = Read("orderId");
            var subOrderId = Read("subOrderId");
            var hasReturn = Read("returnId").HasValue;
            var hasReview = Read("reviewId").HasValue;

            // الإشعارات القديمة تحمل الطلب الفرعي فقط
            if (orderId == null && subOrderId != null)
                orderId = await _context.SubOrders.Where(s => s.Id == subOrderId).Select(s => (Guid?)s.OrderId).FirstOrDefaultAsync(ct);

            switch (role?.ToUpperInvariant())
            {
                case "ADMIN":
                    if (hasReturn) return "/admin/returns";
                    if (hasReview) return "/admin/reviews";
                    return orderId != null ? $"/admin/orders/{orderId}" : null;

                case "OPS":
                    return orderId != null ? $"/operations/orders?order={orderId}" : null;

                case "DRIVER":
                    return "/driver";

                case "VENDOR":
                {
                    if (hasReview) return "/vendor/reviews";
                    var vendorId = await _context.Vendors.Where(v => v.OwnerId == userId).Select(v => (Guid?)v.Id).FirstOrDefaultAsync(ct);
                    if (vendorId == null) return null;
                    // الطلب الفرعي الخاص بمتجر هذا البائع فقط
                    var sub = await _context.SubOrders
                        .Where(s => s.VendorId == vendorId && (subOrderId != null ? s.Id == subOrderId : s.OrderId == orderId))
                        .Select(s => (Guid?)s.Id)
                        .FirstOrDefaultAsync(ct);
                    return sub != null ? $"/vendor/orders?order={sub}" : "/vendor/orders";
                }

                default: // CUSTOMER
                    if (hasReturn) return "/returns";
                    if (orderId == null) return null;
                    // صفحة الزبون تفتح الطلب برقمه (ORD-...) لا بمعرّفه
                    var number = await _context.Orders
                        .Where(o => o.Id == orderId && o.CustomerId == userId)
                        .Select(o => o.OrderNumber)
                        .FirstOrDefaultAsync(ct);
                    return number != null ? $"/orders/{number}" : null;
            }
        }
    }
}
