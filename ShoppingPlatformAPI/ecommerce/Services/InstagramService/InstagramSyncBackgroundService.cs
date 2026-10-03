using ecommerce.Core.Models;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.InstagramService
{
    // مزامنة دورية: تجدّد التوكنات وروابط الوسائط (روابط إنستغرام مؤقتة) وتجلب المنشورات الجديدة
    public class InstagramSyncBackgroundService : BackgroundService
    {
        private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(5);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly InstagramOptions _options;
        private readonly ILogger<InstagramSyncBackgroundService> _logger;

        public InstagramSyncBackgroundService(
            IServiceScopeFactory scopeFactory,
            IOptions<InstagramOptions> options,
            ILogger<InstagramSyncBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _options = options.Value;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_options.IsConfigured)
            {
                _logger.LogInformation("Instagram is not configured — background sync disabled");
                return;
            }

            // مهلة بعد التشغيل حتى لا تُبطئ بدء الخادم
            try { await Task.Delay(TimeSpan.FromSeconds(90), stoppingToken); }
            catch (OperationCanceledException) { return; }

            using var timer = new PeriodicTimer(CheckInterval);
            do
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var service = scope.ServiceProvider.GetRequiredService<IInstagramService>();
                    var synced = await service.SyncDueConnectionsAsync(stoppingToken);
                    if (synced > 0)
                        _logger.LogInformation("Instagram background sync updated {Count} store(s)", synced);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Instagram background sync failed");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
    }
}
