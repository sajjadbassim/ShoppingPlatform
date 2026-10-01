using System.Text.RegularExpressions;

namespace ecommerce.Core.Constants
{
    // الإيميل بصيغة واحدة (بلا مسافات، أحرف صغيرة) — فريد لكل حساب
    public static class EmailAddress
    {
        private static readonly Regex Valid = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

        public static string Normalize(string? input) => (input ?? "").Trim().ToLowerInvariant();

        public static bool IsValid(string normalized) => normalized.Length <= 255 && Valid.IsMatch(normalized);

        // الدخول: هل المكتوب إيميل أم هاتف؟
        public static bool LooksLikeEmail(string? input) => (input ?? "").Contains('@');
    }
}
