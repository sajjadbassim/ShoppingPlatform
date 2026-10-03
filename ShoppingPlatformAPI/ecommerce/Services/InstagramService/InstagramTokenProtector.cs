using Microsoft.AspNetCore.DataProtection;

namespace ecommerce.Services.InstagramService
{
    // تشفير توكنات إنستغرام قبل حفظها في قاعدة البيانات
    public interface IInstagramTokenProtector
    {
        string Protect(string token);
        string Unprotect(string protectedToken);
    }

    public class InstagramTokenProtector : IInstagramTokenProtector
    {
        private readonly IDataProtector _protector;

        public InstagramTokenProtector(IDataProtectionProvider provider)
        {
            _protector = provider.CreateProtector("ecommerce.Instagram.Tokens.v1");
        }

        public string Protect(string token) => _protector.Protect(token);

        public string Unprotect(string protectedToken) => _protector.Unprotect(protectedToken);
    }
}
