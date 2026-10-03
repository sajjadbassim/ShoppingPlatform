namespace ecommerce.Core.Constants
{
    // حالة الطلب الرئيسي من حالات طلباته الفرعية (متجر لكل طلب فرعي) — مصدر واحد للمتجر والعمليات والسائق
    public static class OrderStatusRollup
    {
        public static string Compute(IReadOnlyCollection<string> subStatuses)
        {
            int Count(string s) => subStatuses.Count(x => x == s);

            var total = subStatuses.Count;
            var cancelled = Count(OrderStatus.CANCELLED);
            var delivered = Count(OrderStatus.DELIVERED);
            var failed = Count(OrderStatus.DELIVERY_FAILED);
            var outForDel = Count(OrderStatus.OUT_FOR_DELIVERY);
            var ready = Count(OrderStatus.READY);
            var preparing = Count(OrderStatus.PREPARING);
            var confirmed = Count(OrderStatus.CONFIRMED);
            var active = total - cancelled;

            if (total == 0 || cancelled == total) return OrderStatus.CANCELLED;
            if (failed > 0 && delivered == 0 && failed == active) return OrderStatus.DELIVERY_FAILED;
            if (failed > 0 && delivered > 0 && delivered + failed == active) return OrderStatus.DELIVERED;
            if (delivered == active) return OrderStatus.DELIVERED;
            if (outForDel > 0) return OrderStatus.OUT_FOR_DELIVERY;
            if (ready > 0 && ready + delivered == active) return OrderStatus.READY;     // كل المتاجر (الباقية) جهّزت
            if (ready > 0 || preparing > 0) return OrderStatus.PREPARING;               // بعضها ما زال يحضّر
            if (confirmed == active) return OrderStatus.CONFIRMED;
            if (confirmed > 0) return OrderStatus.PARTIALLY_CONFIRMED;
            return OrderStatus.PENDING_CONFIRMATION;
        }
    }
}
