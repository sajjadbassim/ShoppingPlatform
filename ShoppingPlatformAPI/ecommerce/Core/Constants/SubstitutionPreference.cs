using ecommerce.Core.Exceptions;

namespace ecommerce.Core.Constants
{
    // ماذا يفعل المتجر إن نفد منتج سوبرماركت في الطلب — يختاره الزبون عند الدفع
    public static class SubstitutionPreference
    {
        public const string Remove = "REMOVE";    // احذفه وأعد المبلغ
        public const string Similar = "SIMILAR";  // استبدله بمنتج مشابه بسعر لا يزيد عن الأصلي

        public static string Parse(string? value) => value?.Trim().ToUpperInvariant() switch
        {
            null or "" or Remove => Remove,
            Similar => Similar,
            _ => throw new BusinessRuleException("تفضيل الاستبدال غير صحيح")
        };

        public static string Ar(string? value) => value switch
        {
            Similar => "استبدله بمنتج مشابه",
            Remove => "احذفه وأعد المبلغ",
            _ => ""
        };
    }
}
