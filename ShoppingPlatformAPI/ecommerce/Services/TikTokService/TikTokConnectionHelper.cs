using System.Net;
using System.Net.Sockets;

namespace ecommerce.Services.TikTokService
{
    // open.tiktokapis.com يُحَلّ لعدة عناوين، وبعضها قد يكون غير قابل للوصول من شبكة الخادم.
    // الاتصال الافتراضي يجرّبها بالترتيب وينتظر حتى المهلة عند العنوان المعطّل.
    // هنا نجرّب كل العناوين معاً ونستخدم أول اتصال ينجح (أسلوب Happy Eyeballs).
    public static class TikTokConnectionHelper
    {
        public static async ValueTask<Stream> ConnectToFastestAsync(SocketsHttpConnectionContext context, CancellationToken ct)
        {
            var endpoint = context.DnsEndPoint;
            var addresses = await Dns.GetHostAddressesAsync(endpoint.Host, ct);

            // IPv4 أولاً — IPv6 غالباً غير متاح في الشبكات المحلية
            var candidates = addresses
                .OrderBy(a => a.AddressFamily == AddressFamily.InterNetwork ? 0 : 1)
                .ToList();
            if (candidates.Count == 0)
                throw new HttpRequestException($"No addresses found for {endpoint.Host}");

            using var raceCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            var attempts = candidates.Select(address => ConnectAsync(address, endpoint.Port, raceCts.Token)).ToList();
            var pending = attempts.ToList();
            Exception? lastError = null;

            while (pending.Count > 0)
            {
                var finished = await Task.WhenAny(pending);
                pending.Remove(finished);

                if (finished.IsCompletedSuccessfully)
                {
                    // إلغاء بقية المحاولات وإغلاق أي اتصال ناجح متأخر
                    raceCts.Cancel();
                    foreach (var other in pending)
                        _ = other.ContinueWith(t => { if (t.IsCompletedSuccessfully) t.Result.Dispose(); }, TaskScheduler.Default);
                    return new NetworkStream(finished.Result, ownsSocket: true);
                }

                lastError = finished.Exception?.GetBaseException() ?? lastError;
            }

            ct.ThrowIfCancellationRequested();
            throw new HttpRequestException($"Could not connect to {endpoint.Host}", lastError);
        }

        private static async Task<Socket> ConnectAsync(IPAddress address, int port, CancellationToken ct)
        {
            var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            try
            {
                await socket.ConnectAsync(new IPEndPoint(address, port), ct);
                return socket;
            }
            catch
            {
                socket.Dispose();
                throw;
            }
        }
    }
}
