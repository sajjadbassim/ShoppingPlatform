namespace ecommerce.Core.Constants
{
    // النص العربي لحالات الطلب — كل ما يراه الزبون أو الفريق يمر من هنا بدل رمز الحالة (DELIVERED...)
    public static class OrderStatusText
    {
        public static string Ar(string? status) => status switch
        {
            OrderStatus.PENDING_CONFIRMATION => "بانتظار التأكيد",
            OrderStatus.CONFIRMED => "مؤكد",
            OrderStatus.PARTIALLY_CONFIRMED => "مؤكد جزئياً",
            OrderStatus.PREPARING => "قيد التحضير",
            OrderStatus.READY => "جاهز للاستلام",
            OrderStatus.OUT_FOR_DELIVERY => "في الطريق",
            OrderStatus.DELIVERED => "تم التوصيل",
            OrderStatus.CANCELLED => "ملغي",
            OrderStatus.DELIVERY_FAILED => "تعذّر التسليم",
            null or "" => "—",
            _ => status,
        };

        // نص إشعار الفريق (العمليات/الإدارة): ماذا حدث للطلب، بدل "من X إلى Y"
        public static string StaffMessage(string status, string orderNumber) => status switch
        {
            OrderStatus.CONFIRMED => $"تم تأكيد الطلب {orderNumber} من المتجر",
            OrderStatus.PARTIALLY_CONFIRMED => $"تأكيد جزئي للطلب {orderNumber}: بعض المتاجر أكدت",
            OrderStatus.PREPARING => $"بدأ تحضير الطلب {orderNumber}",
            OrderStatus.READY => $"الطلب {orderNumber} جاهز للاستلام ويحتاج سائقاً",
            OrderStatus.OUT_FOR_DELIVERY => $"الطلب {orderNumber} خرج للتوصيل 🛵",
            OrderStatus.DELIVERED => $"تم توصيل الطلب {orderNumber} ✅",
            OrderStatus.CANCELLED => $"تم إلغاء الطلب {orderNumber}",
            OrderStatus.DELIVERY_FAILED => $"تعذّر تسليم الطلب {orderNumber} ⚠️ يحتاج قراراً: إعادة المحاولة أو الإلغاء",
            _ => $"تحديث الطلب {orderNumber}: {Ar(status)}",
        };

        // نص إشعار الزبون: جملة مفهومة بدل "أصبح في حالة: X"
        public static string CustomerMessage(string status, string orderNumber) => status switch
        {
            OrderStatus.CONFIRMED => $"تم تأكيد طلبك {orderNumber} ✅ وسيبدأ تحضيره قريباً",
            OrderStatus.PARTIALLY_CONFIRMED => $"تم تأكيد جزء من طلبك {orderNumber} — بعض المنتجات غير متوفرة",
            OrderStatus.PREPARING => $"طلبك {orderNumber} قيد التحضير الآن 📦",
            OrderStatus.READY => $"طلبك {orderNumber} جاهز وبانتظار السائق 📦",
            OrderStatus.OUT_FOR_DELIVERY => $"طلبك {orderNumber} في الطريق إليك 🛵",
            OrderStatus.DELIVERED => $"تم توصيل طلبك {orderNumber} 🎉 نتمنى أن ينال إعجابك",
            OrderStatus.CANCELLED => $"تم إلغاء طلبك {orderNumber}",
            OrderStatus.DELIVERY_FAILED => $"تعذّر تسليم طلبك {orderNumber} — سيتواصل معك فريقنا",
            _ => $"تم تحديث طلبك {orderNumber}: {Ar(status)}",
        };
    }
}
