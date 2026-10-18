using ecommerce.Core.Constants;
using ecommerce.Data;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services.OrderSettingsService
{
    // مهلة تأكيد المتجر لا تُلغي الطلب: يبقى بانتظار التأكيد كما هو، ويصل المتجرَ والعمليات إشعار واحد بالتأخير
    public interface IOverdueConfirmationNotifier
    {
        Task<int> NotifyAsync(CancellationToken ct = default);
    }

    public class OverdueConfirmationNotifier : IOverdueConfirmationNotifier
    {
        private readonly AppDbContext _context;
        private readonly INotificationService _notifications;
        private readonly TimeProvider _time;

        public OverdueConfirmationNotifier(AppDbContext context, INotificationService notifications, TimeProvider? time = null)
        {
            _context = context;
            _notifications = notifications;
            _time = time ?? TimeProvider.System;
        }

        public async Task<int> NotifyAsync(CancellationToken ct = default)
        {
            var now = _time.GetUtcNow().UtcDateTime;
            var late = await _context.SubOrders
                .Include(so => so.Order)
                .Include(so => so.Vendor)
                .Where(so => so.Status == SubOrderStatus.PendingConfirmation && so.ConfirmationDeadline != null
                    && so.ConfirmationDeadline < now && so.ConfirmationOverdueNotifiedAt == null)
                .OrderBy(so => so.ConfirmationDeadline)
                .Take(50)
                .ToListAsync(ct);

            foreach (var so in late)
            {
                // يُعلَّم قبل الإرسال: فشل الإشعار لا يكرره كل دقيقة
                so.ConfirmationOverdueNotifiedAt = now;
                await _context.SaveChangesAsync(ct);

                var minutes = (int)Math.Max(1, Math.Ceiling((now - so.ConfirmationDeadline!.Value).TotalMinutes));
                var data = new { orderId = so.OrderId, subOrderId = so.Id };
                await _notifications.NotifyVendorAsync(so.VendorId, NotificationCategory.NewOrders, NotificationType.SUB_ORDER,
                    $"الطلب {so.SubOrderNumber} تأخر تأكيده {minutes} د — الزبون بانتظارك، أكّده أو اعتذر عنه", data);
                await _notifications.NotifyOpsAsync(NotificationCategory.NewOrders, NotificationType.SUB_ORDER,
                    $"تأخر تأكيد الطلب {so.SubOrderNumber} من {so.Vendor?.DisplayName} ({minutes} د)", data);
            }
            return late.Count;
        }
    }

    // يفحص كل دقيقة
    public class OverdueConfirmationBackgroundService : BackgroundService
    {
        private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(1);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<OverdueConfirmationBackgroundService> _logger;

        public OverdueConfirmationBackgroundService(IServiceScopeFactory scopeFactory, ILogger<OverdueConfirmationBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(CheckInterval);
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var sent = await scope.ServiceProvider.GetRequiredService<IOverdueConfirmationNotifier>().NotifyAsync(stoppingToken);
                    if (sent > 0) _logger.LogInformation("Overdue confirmations notified: {Count}", sent);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Overdue confirmation job failed");
                }
            }
        }
    }
}
