using ecommerce.Core.Models;

namespace ecommerce.Core.Constants
{
    // إجماليات الطلب بعد إلغاء جزء منه: ما يدفعه الزبون = المتاجر الباقية فقط (الخصم يبقى، ولا يقل المبلغ عن صفر).
    // الطلب الملغى بالكامل يحتفظ بإجمالياته الأصلية للسجل.
    public static class OrderTotals
    {
        public static bool Recalculate(Order order, IEnumerable<SubOrder> subOrders)
        {
            var active = subOrders.Where(s => s.Status != OrderStatus.CANCELLED).ToList();
            if (active.Count == 0) return false;

            var subtotal = active.Sum(s => s.Subtotal);
            var fees = active.Sum(s => s.DeliveryFee);
            var total = Math.Max(0, subtotal + fees - order.DiscountAmount);
            if (order.Subtotal == subtotal && order.DeliveryFees == fees && order.TotalAmount == total) return false;

            order.Subtotal = subtotal;
            order.DeliveryFees = fees;
            order.TotalAmount = total;
            order.UpdatedAt = DateTime.UtcNow;
            return true;
        }
    }
}
