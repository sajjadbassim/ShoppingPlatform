namespace ecommerce.Core.Constants
{
    public static class OrderStatus
    {
        public const string PENDING_CONFIRMATION = "PENDING_CONFIRMATION";  // بانتظار التأكيد
        public const string CONFIRMED = "CONFIRMED";                        // مؤكد
        public const string PARTIALLY_CONFIRMED = "PARTIALLY_CONFIRMED";    // مؤكد جزئياً
        public const string PREPARING = "PREPARING";                        // قيد التحضير
        public const string OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY";         // في الطريق
        public const string DELIVERED = "DELIVERED";                        // تم التوصيل
        public const string CANCELLED = "CANCELLED";                        // ملغي
    }
}
