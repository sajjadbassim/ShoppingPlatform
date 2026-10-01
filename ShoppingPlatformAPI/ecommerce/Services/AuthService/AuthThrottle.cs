using Microsoft.Extensions.Caching.Memory;

namespace ecommerce.Services.AuthService
{
    // حدود المحاولات لكل رقم هاتف (في الذاكرة):
    // - الدخول: 5 محاولات خاطئة خلال 15 دقيقة ← إيقاف 15 دقيقة
    // - رمز استعادة كلمة المرور: 3 طلبات خلال 15 دقيقة
    public interface IAuthThrottle
    {
        void EnsureLoginAllowed(string phone);
        void LoginFailed(string phone);
        void LoginSucceeded(string phone);
        void EnsureOtpRequestAllowed(string phone);
    }

    public class AuthThrottle : IAuthThrottle
    {
        public const int MaxLoginFailures = 5;
        public const int MaxOtpRequests = 3;
        public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);

        private readonly IMemoryCache _cache;
        private readonly TimeProvider _time;
        private readonly object _lock = new();

        public AuthThrottle(IMemoryCache cache, TimeProvider? time = null)
        {
            _cache = cache;
            _time = time ?? TimeProvider.System;
        }

        private sealed class Counter
        {
            public int Count;
            public DateTimeOffset ResetAt;
        }

        private Counter Get(string key)
        {
            var now = _time.GetUtcNow();
            if (!_cache.TryGetValue(key, out Counter? c) || c == null || c.ResetAt <= now)
            {
                c = new Counter { Count = 0, ResetAt = now + Window };
                _cache.Set(key, c, c.ResetAt);
            }
            return c;
        }

        private string Wait(Counter c)
        {
            var minutes = Math.Max(1, (int)Math.Ceiling((c.ResetAt - _time.GetUtcNow()).TotalMinutes));
            return $"{minutes} دقيقة";
        }

        public void EnsureLoginAllowed(string phone)
        {
            lock (_lock)
            {
                var c = Get($"login:{phone}");
                if (c.Count >= MaxLoginFailures)
                    throw new Exception($"محاولات دخول خاطئة كثيرة — حاول بعد {Wait(c)} أو استعد كلمة المرور");
            }
        }

        public void LoginFailed(string phone)
        {
            lock (_lock) { Get($"login:{phone}").Count++; }
        }

        public void LoginSucceeded(string phone) => _cache.Remove($"login:{phone}");

        public void EnsureOtpRequestAllowed(string phone)
        {
            lock (_lock)
            {
                var c = Get($"otp:{phone}");
                if (c.Count >= MaxOtpRequests)
                    throw new Exception($"طلبت رموزاً كثيرة — حاول بعد {Wait(c)}");
                c.Count++;
            }
        }
    }
}
