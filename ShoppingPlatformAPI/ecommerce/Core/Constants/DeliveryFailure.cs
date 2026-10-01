namespace ecommerce.Core.Constants
{
    // أسباب تعذّر التسليم التي يسجلها السائق
    public static class DeliveryFailureReason
    {
        public const string CustomerRefused = "customer_refused";
        public const string NoAnswer = "no_answer";
        public const string WrongAddress = "wrong_address";
        public const string Other = "other";

        public static readonly string[] All = { CustomerRefused, NoAnswer, WrongAddress, Other };

        public static string Ar(string? reason) => reason switch
        {
            CustomerRefused => "رفض الزبون الطلب",
            NoAnswer => "الزبون لا يرد",
            WrongAddress => "العنوان خاطئ أو غير موجود",
            _ => "سبب آخر",
        };
    }

    // من يتحمّل أجرة التوصيل عند رفض الزبون (كاملاً أو جزئياً) — إعداد تغيّره العمليات/الإدارة
    public static class RefusalFeePayer
    {
        public const string Customer = "CUSTOMER";
        public const string Vendor = "VENDOR";
        public const string None = "NONE";

        public static readonly string[] All = { Customer, Vendor, None };
    }
}
