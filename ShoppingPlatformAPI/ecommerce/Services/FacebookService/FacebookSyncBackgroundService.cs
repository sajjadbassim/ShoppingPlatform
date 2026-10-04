using ecommerce.Core.Models;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.FacebookService
{
    // مزامنة دورية كاملة: تجدّد روابط الوسائط (روابط فيسبوك مؤقتة) وتجلب الجديد وتكشف المحذوف
    public class FacebookSyncBackgroundService : BackgroundService
    {
        private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(5);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly FacebookOptions _options;
        private readonly ILogger<FacebookSyncBackgroundService> _logger;

        public FacebookSyncBackgroundService(
            IServiceScopeFactory scopeFactory,
            IOptions<FacebookOptions> options,
            ILogger<FacebookSyncBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _options = options.Value;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_options.IsConfigured)
            {
                _logger.LogInformation("Facebook is not configured — background sync disabled");
                return;
            }

            // مهلة بعد التشغيل حتى لا تُبطئ بدء الخادم (ولا تتزامن مع تيك توك وإنستغرام)
            try { await Task.Delay(TimeSpan.FromSeconds(120), stoppingToken); }
            catch (OperationCanceledException) { return; }

            using var timer = new PeriodicTimer(CheckInterval);
            do
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var service = scope.ServiceProvider.GetRequiredService<IFacebookService>();
                    var synced = await service.SyncDueConnectionsAsync(stoppingToken);
                    if (synced > 0)
                        _logger.LogInformation("Facebook background sync updated {Count} store(s)", synced);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Facebook background sync failed");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
    }
}
