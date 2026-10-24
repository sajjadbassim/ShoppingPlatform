using ecommerce.Core.Constants;
using ecommerce.Data;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Text.Json;
using System.Threading.Channels;
using WebPush;

namespace ecommerce.Services.PushService
{
    // مفاتيح VAPID — المفتاح الخاص في user-secrets أو متغيرات البيئة فقط
    public class PushOptions
    {
        public const string Section = "Push";
        public string? PublicKey { get; set; }
        public string? PrivateKey { get; set; }
        public string Subject { get; set; } = "mailto:admin@example.com";
        public bool IsConfigured => !string.IsNullOrWhiteSpace(PublicKey) && !string.IsNullOrWhiteSpace(PrivateKey);
    }

    // رسالة دفع: لمستخدم واحد (UserId) أو لكل مستخدمي دور (Role)
    public record PushMessage(string Body, Guid? UserId = null, string? Role = null, Guid? NotificationId = null, string? Url = null, string? Tag = null);

    public interface IPushQueue
    {
        void Enqueue(PushMessage message);
    }

    // الإرسال يتم في الخلفية حتى لا يُبطئ الطلبات (خدمات الدفع قد تتأخر ثوانٍ)
    public class PushQueue : IPushQueue
    {
        private readonly Channel<PushMessage> _channel = Channel.CreateBounded<PushMessage>(
            new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropOldest });

        public ChannelReader<PushMessage> Reader => _channel.Reader;

        public void Enqueue(PushMessage message) => _channel.Writer.TryWrite(message);
    }

    public class PushSenderService : BackgroundService
    {
        private const string Title = "واسط";

        private readonly PushQueue _queue;
        private readonly IServiceScopeFactory _scopes;
        private readonly PushOptions _options;
        private readonly IFcmSender _fcm;
        private readonly ILogger<PushSenderService> _logger;
        private readonly WebPushClient _client = new();

        public PushSenderService(PushQueue queue, IServiceScopeFactory scopes, Microsoft.Extensions.Options.IOptions<PushOptions> options, IFcmSender fcm, ILogger<PushSenderService> logger)
        {
            _queue = queue;
            _scopes = scopes;
            _options = options.Value;
            _fcm = fcm;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_options.IsConfigured)
                _logger.LogWarning("Web Push غير مفعّل: مفاتيح Push:PublicKey / Push:PrivateKey غير موجودة");
            if (!_fcm.IsConfigured)
                _logger.LogWarning("إشعارات الموبايل (FCM) غير مفعّلة: Firebase:CredentialsPath غير مضبوط أو الملف غير موجود");
            if (!_options.IsConfigured && !_fcm.IsConfigured) return;

            var vapid = _options.IsConfigured ? new VapidDetails(_options.Subject, _options.PublicKey, _options.PrivateKey) : null;

            await foreach (var message in _queue.Reader.ReadAllAsync(stoppingToken))
            {
                try { await SendAsync(message, vapid, stoppingToken); }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogWarning(ex, "فشل إرسال إشعار دفع");
                }
            }
        }

        private async Task SendAsync(PushMessage message, VapidDetails? vapid, CancellationToken ct)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var recipients = message.UserId.HasValue
                ? await db.Users.Where(u => u.Id == message.UserId && u.IsActive).Select(u => new { u.Id, u.Role }).ToListAsync(ct)
                : await db.Users.Where(u => u.Role == message.Role && u.IsActive).Select(u => new { u.Id, u.Role }).ToListAsync(ct);
            if (recipients.Count == 0) return;

            var ids = recipients.Select(r => r.Id).ToList();
            var subscriptions = vapid == null ? new List<Core.Models.PushSubscription>()
                : await db.PushSubscriptions.Where(s => ids.Contains(s.UserId)).ToListAsync(ct);
            var devices = !_fcm.IsConfigured ? new List<Core.Models.DeviceToken>()
                : await db.DeviceTokens.Where(d => ids.Contains(d.UserId)).ToListAsync(ct);
            if (subscriptions.Count == 0 && devices.Count == 0) return;

            var links = scope.ServiceProvider.GetRequiredService<INotificationLinkService>();
            var gone = new List<Core.Models.PushSubscription>();

            foreach (var r in recipients)
            {
                // الرابط حسب دور المستلم (نفس منطق الضغط على الإشعار داخل التطبيق)
                var url = message.Url;
                if (url == null && message.NotificationId.HasValue)
                    url = await links.GetLinkAsync(message.NotificationId.Value, r.Id, r.Role, ct);

                var payload = JsonSerializer.Serialize(new
                {
                    title = Title,
                    body = message.Body,
                    url = url ?? "/notifications",
                    tag = message.Tag,
                });

                // أجهزة الموبايل (FCM): الإشعار المعروض + بيانات لفتح الشاشة المناسبة عند الضغط
                var myDevices = devices.Where(d => d.UserId == r.Id).ToList();
                if (myDevices.Count > 0)
                {
                    var data = new Dictionary<string, string> { ["url"] = url ?? "/notifications" };
                    if (message.Tag != null) data["tag"] = message.Tag;
                    if (message.NotificationId.HasValue) data["notificationId"] = message.NotificationId.Value.ToString();

                    var dead = await _fcm.SendAsync(myDevices.Select(d => d.Token).ToList(), new FcmMessage(Title, message.Body, data), ct);
                    var now = DateTime.UtcNow;
                    foreach (var d in myDevices)
                    {
                        if (dead.Contains(d.Token)) db.DeviceTokens.Remove(d);   // التطبيق حُذف من الجهاز أو انتهى الرمز
                        else d.LastUsedAt = now;
                    }
                }

                foreach (var sub in subscriptions.Where(s => s.UserId == r.Id))
                {
                    try
                    {
                        await _client.SendNotificationAsync(new WebPush.PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth), payload, vapid!, ct);
                        sub.LastUsedAt = DateTime.UtcNow;
                    }
                    catch (WebPushException ex) when (ex.StatusCode is HttpStatusCode.Gone or HttpStatusCode.NotFound or HttpStatusCode.Forbidden)
                    {
                        gone.Add(sub); // ألغى المستخدم الإذن أو حُذف التطبيق
                    }
                    catch (WebPushException ex)
                    {
                        _logger.LogWarning("رفضت خدمة الدفع الإشعار ({Status})", ex.StatusCode);
                    }
                }
            }

            db.PushSubscriptions.RemoveRange(gone);
            await db.SaveChangesAsync(ct);
        }
    }
}
