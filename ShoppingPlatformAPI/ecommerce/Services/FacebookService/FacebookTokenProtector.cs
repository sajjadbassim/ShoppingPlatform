using Microsoft.AspNetCore.DataProtection;

namespace ecommerce.Services.FacebookService
{
    // تشفير توكنات صفحات فيسبوك قبل حفظها (وتوكن المستخدم أثناء اختيار الصفحة)
    public interface IFacebookTokenProtector
    {
        string Protect(string token);
        string Unprotect(string protectedToken);
    }

    public class FacebookTokenProtector : IFacebookTokenProtector
    {
        private readonly IDataProtector _protector;

        public FacebookTokenProtector(IDataProtectionProvider provider)
        {
            _protector = provider.CreateProtector("ecommerce.Facebook.Tokens.v1");
        }

        public string Protect(string token) => _protector.Protect(token);

        public string Unprotect(string protectedToken) => _protector.Unprotect(protectedToken);
    }
}
