using ecommerce.Core.Models;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.TikTokService
{
    // مزامنة دورية: تجدّد التوكنات وروابط أغلفة الفيديوهات (روابط تيك توك مؤقتة) وتجلب الفيديوهات الجديدة
    public class TikTokSyncBackgroundService : BackgroundService
    {
        private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(5);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly TikTokOptions _options;
        private readonly ILogger<TikTokSyncBackgroundService> _logger;

        public TikTokSyncBackgroundService(
            IServiceScopeFactory scopeFactory,
            IOptions<TikTokOptions> options,
            ILogger<TikTokSyncBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _options = options.Value;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_options.IsConfigured)
            {
                _logger.LogInformation("TikTok is not configured — background sync disabled");
                return;
            }

            // مهلة بعد التشغيل حتى لا تُبطئ بدء الخادم
            try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
            catch (OperationCanceledException) { return; }

            using var timer = new PeriodicTimer(CheckInterval);
            do
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var service = scope.ServiceProvider.GetRequiredService<ITikTokService>();
                    var synced = await service.SyncDueConnectionsAsync(stoppingToken);
                    if (synced > 0)
                        _logger.LogInformation("TikTok background sync updated {Count} store(s)", synced);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "TikTok background sync failed");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
    }
}
