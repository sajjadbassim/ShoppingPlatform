using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services.EngagementService
{
    public class StockAlertStatusDto
    {
        public bool Subscribed { get; set; }
    }

    public interface ICustomerEngagementService
    {
        // «أعلمني عند التوفر»
        Task<StockAlertStatusDto> GetStockAlertAsync(Guid userId, Guid productId, Guid? variantId, CancellationToken ct = default);
        Task<StockAlertStatusDto> SubscribeStockAlertAsync(Guid userId, Guid productId, Guid? variantId, CancellationToken ct = default);
        Task<StockAlertStatusDto> UnsubscribeStockAlertAsync(Guid userId, Guid productId, Guid? variantId, CancellationToken ct = default);

        // المعالجة الدورية (CustomerEngagementBackgroundService)
        Task<int> ProcessStockAlertsAsync(CancellationToken ct = default);
        Task<int> ProcessCartRemindersAsync(CancellationToken ct = default);
    }

    public class CustomerEngagementService : ICustomerEngagementService
    {
        public const int MaxPendingAlertsPerUser = 50;
        public static readonly TimeSpan AlertLifetime = TimeSpan.FromDays(90);
        // السلة تُذكَّر بعد 3 ساعات بلا تغيير، ولا نذكّر بسلة لم تُلمس منذ أكثر من 3 أيام
        public static readonly TimeSpan CartIdleBeforeReminder = TimeSpan.FromHours(3);
        public static readonly TimeSpan CartReminderWindow = TimeSpan.FromDays(3);
        private const int BatchSize = 200;

        private readonly AppDbContext _context;
        private readonly INotificationService _notifications;
        private readonly TimeProvider _time;
        private readonly ILogger<CustomerEngagementService> _logger;

        public CustomerEngagementService(AppDbContext context, INotificationService notifications,
            ILogger<CustomerEngagementService> logger, TimeProvider? time = null)
        {
            _context = context;
            _notifications = notifications;
            _logger = logger;
            _time = time ?? TimeProvider.System;
        }

        private DateTime Now => _time.GetUtcNow().UtcDateTime;

        // ===================================
        // أعلمني عند التوفر
        // ===================================
        public async Task<StockAlertStatusDto> GetStockAlertAsync(Guid userId, Guid productId, Guid? variantId, CancellationToken ct = default)
            => new() { Subscribed = await PendingAlerts(userId, productId, variantId).AnyAsync(ct) };

        public async Task<StockAlertStatusDto> SubscribeStockAlertAsync(Guid userId, Guid productId, Guid? variantId, CancellationToken ct = default)
        {
            var product = await _context.Products.AsNoTracking()
                .Where(p => p.Id == productId && p.IsActive && !p.IsDeleted && p.Vendor.IsActive)
                .Select(p => new { p.Id, p.CategoryId })
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException("المنتج غير موجود");
            if (product.CategoryId.HasValue && (await CategoryVisibility.GetHiddenCategoryIdsAsync(_context)).Contains(product.CategoryId.Value))
                throw new NotFoundException("المنتج غير موجود");
            if (variantId.HasValue && !await _context.ProductVariants.AnyAsync(v => v.Id == variantId && v.ProductId == productId, ct))
                throw new NotFoundException("الخيار المحدد غير موجود");

            if (await PendingAlerts(userId, productId, variantId).AnyAsync(ct))
                return new() { Subscribed = true };
            if ((await AvailabilityAsync(new[] { (productId, variantId) }, ct)).Contains((productId, variantId)))
                throw new BusinessRuleException("المنتج متوفر الآن — يمكنك طلبه مباشرة");
            if (await _context.StockAlerts.CountAsync(a => a.UserId == userId && a.NotifiedAt == null, ct) >= MaxPendingAlertsPerUser)
                throw new BusinessRuleException($"لديك {MaxPendingAlertsPerUser} تنبيهاً بانتظار التوفر — ألغِ بعضها أولاً");

            _context.StockAlerts.Add(new StockAlert { UserId = userId, ProductId = productId, VariantId = variantId, CreatedAt = Now });
            await _context.SaveChangesAsync(ct);
            return new() { Subscribed = true };
        }

        public async Task<StockAlertStatusDto> UnsubscribeStockAlertAsync(Guid userId, Guid productId, Guid? variantId, CancellationToken ct = default)
        {
            var alerts = await PendingAlerts(userId, productId, variantId).ToListAsync(ct);
            if (alerts.Count > 0)
            {
                _context.StockAlerts.RemoveRange(alerts);
                await _context.SaveChangesAsync(ct);
            }
            return new() { Subscribed = false };
        }

        private IQueryable<StockAlert> PendingAlerts(Guid userId, Guid productId, Guid? variantId) =>
            _context.StockAlerts.Where(a => a.UserId == userId && a.ProductId == productId && a.VariantId == variantId && a.NotifiedAt == null);

        public async Task<int> ProcessStockAlertsAsync(CancellationToken ct = default)
        {
            var now = Now;

            // التنبيهات القديمة جداً لم تعد مفيدة
            var expired = await _context.StockAlerts.Where(a => a.NotifiedAt == null && a.CreatedAt < now - AlertLifetime).ToListAsync(ct);
            if (expired.Count > 0)
            {
                _context.StockAlerts.RemoveRange(expired);
                await _context.SaveChangesAsync(ct);
            }

            var pending = await _context.StockAlerts
                .Where(a => a.NotifiedAt == null)
                .OrderBy(a => a.CreatedAt)
                .Take(BatchSize * 5)
                .ToListAsync(ct);
            if (pending.Count == 0) return 0;

            var available = await AvailabilityAsync(pending.Select(a => (a.ProductId, a.VariantId)).Distinct().ToList(), ct);
            var ready = pending.Where(a => available.Contains((a.ProductId, a.VariantId))).Take(BatchSize).ToList();
            if (ready.Count == 0) return 0;

            var productIds = ready.Select(a => a.ProductId).Distinct().ToList();
            var names = await _context.Products.AsNoTracking().Where(p => productIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.NameAr ?? p.Name, ct);

            // يُعلَّم أولاً ثم يُرسل: تعطل الإرسال لا يكرر الإشعار في الدورة التالية
            foreach (var alert in ready) alert.NotifiedAt = now;
            await _context.SaveChangesAsync(ct);

            foreach (var alert in ready)
            {
                try
                {
                    await _notifications.NotifyCustomerReminderAsync(alert.UserId,
                        $"«{names.GetValueOrDefault(alert.ProductId, "منتج طلبت تنبيهه")}» متوفر الآن — اطلبه قبل أن ينفد",
                        new { productId = alert.ProductId, link = $"/products/{alert.ProductId}" });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Stock alert {AlertId} notification failed", alert.Id);
                }
            }
            return ready.Count;
        }

        // المتوفر الآن للعامة: منتج ظاهر، وبلا خيارات → متوفر وبمخزون؛ بخيارات → الخيار المطلوب (أو أي خيار) متوفر وبمخزون
        private async Task<HashSet<(Guid ProductId, Guid? VariantId)>> AvailabilityAsync(
            IReadOnlyCollection<(Guid ProductId, Guid? VariantId)> keys, CancellationToken ct)
        {
            var productIds = keys.Select(k => k.ProductId).Distinct().ToList();
            var hidden = (await CategoryVisibility.GetHiddenCategoryIdsAsync(_context)).ToList();
            var products = await _context.Products.AsNoTracking()
                .Where(p => productIds.Contains(p.Id) && p.IsActive && !p.IsDeleted && p.Vendor.IsActive &&
                            (p.CategoryId == null || !hidden.Contains(p.CategoryId.Value)))
                .Select(p => new { p.Id, p.IsAvailable, p.StockQuantity })
                .ToDictionaryAsync(p => p.Id, ct);
            var variants = await _context.ProductVariants.AsNoTracking()
                .Where(v => productIds.Contains(v.ProductId))
                .Select(v => new { v.Id, v.ProductId, InStock = v.IsAvailable && v.StockQuantity > 0 })
                .ToListAsync(ct);
            var variantsByProduct = variants.ToLookup(v => v.ProductId);

            var result = new HashSet<(Guid, Guid?)>();
            foreach (var key in keys)
            {
                if (!products.TryGetValue(key.ProductId, out var product)) continue;
                var own = variantsByProduct[key.ProductId].ToList();
                var inStock = key.VariantId.HasValue
                    ? own.Any(v => v.Id == key.VariantId && v.InStock)
                    : own.Count > 0 ? own.Any(v => v.InStock) : product.IsAvailable && product.StockQuantity > 0;
                if (inStock) result.Add(key);
            }
            return result;
        }

        // ===================================
        // تذكير السلة المتروكة
        // ===================================
        public async Task<int> ProcessCartRemindersAsync(CancellationToken ct = default)
        {
            var now = Now;
            var idleSince = now - CartIdleBeforeReminder;
            var windowStart = now - CartReminderWindow;

            var candidates = await _context.Carts.AsNoTracking()
                .Where(c => c.Items.Any() && c.User.IsActive && c.User.Role == UserRoles.Customer)
                .Select(c => new
                {
                    c.Id,
                    c.UserId,
                    c.ReminderSentAt,
                    Count = c.Items.Sum(i => i.Quantity),
                    LastActivity = c.Items.Max(i => i.UpdatedAt > i.CreatedAt ? i.UpdatedAt : i.CreatedAt) > c.UpdatedAt
                        ? c.Items.Max(i => i.UpdatedAt > i.CreatedAt ? i.UpdatedAt : i.CreatedAt)
                        : c.UpdatedAt,
                })
                .Where(c => c.LastActivity <= idleSince && c.LastActivity >= windowStart &&
                            (c.ReminderSentAt == null || c.ReminderSentAt < c.LastActivity))
                .OrderBy(c => c.LastActivity)
                .Take(BatchSize)
                .ToListAsync(ct);
            if (candidates.Count == 0) return 0;

            var ids = candidates.Select(c => c.Id).ToList();
            var carts = await _context.Carts.Where(c => ids.Contains(c.Id)).ToListAsync(ct);
            foreach (var cart in carts) cart.ReminderSentAt = now;
            await _context.SaveChangesAsync(ct);

            foreach (var c in candidates)
            {
                try
                {
                    await _notifications.NotifyCustomerReminderAsync(c.UserId,
                        c.Count == 1
                            ? "تركت منتجاً في سلتك — أكمل طلبك قبل أن ينفد"
                            : $"تركت {c.Count} منتجات في سلتك — أكمل طلبك قبل أن تنفد",
                        new { link = "/cart" });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Cart reminder for cart {CartId} failed", c.Id);
                }
            }
            return candidates.Count;
        }
    }

    // يشغّل تنبيهات التوفر وتذكير السلة كل 5 دقائق
    public class CustomerEngagementBackgroundService : BackgroundService
    {
        private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(5);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<CustomerEngagementBackgroundService> _logger;

        public CustomerEngagementBackgroundService(IServiceScopeFactory scopeFactory, ILogger<CustomerEngagementBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
            catch (OperationCanceledException) { return; }

            using var timer = new PeriodicTimer(CheckInterval);
            do
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var service = scope.ServiceProvider.GetRequiredService<ICustomerEngagementService>();
                    var alerts = await service.ProcessStockAlertsAsync(stoppingToken);
                    var carts = await service.ProcessCartRemindersAsync(stoppingToken);
                    if (alerts + carts > 0)
                        _logger.LogInformation("Customer engagement: {Alerts} stock alert(s), {Carts} cart reminder(s)", alerts, carts);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Customer engagement job failed");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
    }
}
