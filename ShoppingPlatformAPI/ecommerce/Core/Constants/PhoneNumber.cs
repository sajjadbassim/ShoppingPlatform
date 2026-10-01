using System.Text.RegularExpressions;

namespace ecommerce.Core.Constants
{
    // رقم الهاتف العراقي بصيغة واحدة: 07XXXXXXXXX
    // يقبل +964 / 00964 / 964 / بدون الصفر، والمسافات والشرطات — حتى لا يُسجَّل نفس الرقم بصيغتين
    public static class PhoneNumber
    {
        private static readonly Regex Valid = new(@"^07[3-9]\d{8}$", RegexOptions.Compiled);

        public static string? Normalize(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return null;
            var digits = new string(input.Where(char.IsDigit).ToArray());

            if (digits.StartsWith("00964")) digits = "0" + digits[5..];
            else if (digits.StartsWith("964")) digits = "0" + digits[3..];
            else if (digits.Length == 10 && digits.StartsWith('7')) digits = "0" + digits;

            return Valid.IsMatch(digits) ? digits : null;
        }

        // للتسجيل وإنشاء الحسابات: الرقم الموحَّد أو رسالة واضحة
        public static string Require(string? input) =>
            Normalize(input) ?? throw new Exception("رقم الهاتف غير صحيح (مثال: 07701234567)");

        // للدخول والبحث: الرقم الموحَّد إن أمكن، وإلا كما كُتب (حسابات قديمة بصيغة مختلفة)
        public static string ForLookup(string? input) => Normalize(input) ?? (input ?? "").Trim();
    }
}
