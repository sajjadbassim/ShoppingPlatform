using Microsoft.AspNetCore.DataProtection;

namespace ecommerce.Services.TikTokService
{
    // تشفير توكنات تيك توك قبل حفظها في قاعدة البيانات
    public interface ITikTokTokenProtector
    {
        string Protect(string token);
        string Unprotect(string protectedToken);
    }

    public class TikTokTokenProtector : ITikTokTokenProtector
    {
        private readonly IDataProtector _protector;

        public TikTokTokenProtector(IDataProtectionProvider provider)
        {
            _protector = provider.CreateProtector("ecommerce.TikTok.Tokens.v1");
        }

        public string Protect(string token) => _protector.Protect(token);

        public string Unprotect(string protectedToken) => _protector.Unprotect(protectedToken);
    }
}
