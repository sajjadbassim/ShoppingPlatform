using ecommerce.Core.Models;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.InstagramService
{
    // ينشر المنشورات المجدولة عند حلول موعدها، ويعيد المحاولة للمؤجلة (حد يومي، خطأ مؤقت)
    public class InstagramPublishBackgroundService : BackgroundService
    {
        private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(30);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly InstagramOptions _options;
        private readonly ILogger<InstagramPublishBackgroundService> _logger;

        public InstagramPublishBackgroundService(IServiceScopeFactory scopeFactory, IOptions<InstagramOptions> options,
            ILogger<InstagramPublishBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _options = options.Value;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_options.IsConfigured || string.IsNullOrWhiteSpace(_options.PublicBaseUrl))
            {
                _logger.LogInformation("Instagram publishing is not configured — scheduled publishing disabled");
                return;
            }

            try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); }
            catch (OperationCanceledException) { return; }

            using var timer = new PeriodicTimer(CheckInterval);
            do
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var service = scope.ServiceProvider.GetRequiredService<IInstagramPublishService>();
                    var processed = await service.ProcessDueAsync(stoppingToken);
                    if (processed > 0)
                        _logger.LogInformation("Instagram publishing processed {Count} post(s)", processed);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Instagram scheduled publishing failed");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
    }
}
