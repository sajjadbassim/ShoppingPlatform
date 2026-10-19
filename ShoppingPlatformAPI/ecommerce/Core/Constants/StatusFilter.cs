using System.Reflection;
using ecommerce.Core.Exceptions;

namespace ecommerce.Core.Constants
{
    // فلتر حالة في القوائم: قيمة غير معروفة (status=BOGUS) كانت ترجع 200 بقائمة فارغة فيظن المستخدم أن لا شيء —
    // الآن 400 برسالة. القيم المسموحة = ثوابت الصنف (OrderStatus، ReturnStatus، ...)
    public static class StatusFilter
    {
        public static void Validate(string? value, Type constants, bool ignoreCase = false)
        {
            if (string.IsNullOrWhiteSpace(value)) return;
            var allowed = constants.GetFields(BindingFlags.Public | BindingFlags.Static)
                .Where(f => f.IsLiteral && f.FieldType == typeof(string))
                .Select(f => (string)f.GetRawConstantValue()!);
            var cmp = ignoreCase ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal;
            if (!allowed.Contains(value, cmp))
                throw new BusinessRuleException($"حالة غير معروفة في الفلتر: «{value}»");
        }
    }
}
