using ecommerce.Core.Models;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.TikTokService
{
    // يتابع منشورات تيك توك التي ما زالت قيد المعالجة عند تيك توك (النشر لا يكتمل دائماً خلال الطلب نفسه)
    public class TikTokPublishBackgroundService : BackgroundService
    {
        private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(30);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly TikTokOptions _options;
        private readonly ILogger<TikTokPublishBackgroundService> _logger;

        public TikTokPublishBackgroundService(IServiceScopeFactory scopeFactory, IOptions<TikTokOptions> options,
            ILogger<TikTokPublishBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _options = options.Value;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_options.IsConfigured || string.IsNullOrWhiteSpace(_options.PublicBaseUrl))
            {
                _logger.LogInformation("TikTok publishing is not configured — status follow-up disabled");
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
                    var service = scope.ServiceProvider.GetRequiredService<ITikTokPublishService>();
                    var processed = await service.ProcessPendingAsync(stoppingToken);
                    if (processed > 0)
                        _logger.LogInformation("TikTok publishing followed up {Count} post(s)", processed);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "TikTok publish follow-up failed");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
    }
}
