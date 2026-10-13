using ecommerce.Core.Models;

namespace ecommerce.Core.Constants
{
    // إجماليات الطلب بعد إلغاء جزء منه: ما يدفعه الزبون = المتاجر الباقية فقط (ولا يقل المبلغ عن صفر).
    // كوبون المتجر يسقط إن أُلغي طلب متجره، ولا يزيد عن قيمة ما بقي منه؛ خصم النقاط يبقى.
    // الطلب الملغى بالكامل يحتفظ بإجمالياته الأصلية للسجل.
    public static class OrderTotals
    {
        public static bool Recalculate(Order order, IEnumerable<SubOrder> subOrders)
        {
            var active = subOrders.Where(s => s.Status != OrderStatus.CANCELLED).ToList();
            if (active.Count == 0) return false;

            var subtotal = active.Sum(s => s.Subtotal);
            var fees = active.Sum(s => s.DeliveryFee);

            var coupon = CouponDiscount(order);
            if (order.CouponVendorId.HasValue)
                coupon = Math.Min(coupon, active.Where(s => s.VendorId == order.CouponVendorId).Sum(s => s.Subtotal));
            var discount = order.PointsDiscountAmount + coupon;

            var total = Math.Max(0, subtotal + fees - discount);
            if (order.Subtotal == subtotal && order.DeliveryFees == fees && order.DiscountAmount == discount && order.TotalAmount == total) return false;

            order.Subtotal = subtotal;
            order.DeliveryFees = fees;
            order.DiscountAmount = discount;
            order.TotalAmount = total;
            order.UpdatedAt = DateTime.UtcNow;
            return true;
        }

        public static decimal CouponDiscount(Order order) => Math.Max(0, order.DiscountAmount - order.PointsDiscountAmount);

        public sealed record Line(Guid Id, Guid VendorId, string Status, decimal Subtotal, decimal DeliveryFee);

        public static Dictionary<Guid, decimal> DiscountShares(Order order, IEnumerable<SubOrder> subOrders) =>
            DiscountShares(order.DiscountAmount, order.PointsDiscountAmount, order.CouponVendorId,
                subOrders.Select(s => new Line(s.Id, s.VendorId, s.Status, s.Subtotal, s.DeliveryFee)));

        // نصيب كل طلب فرعي من خصم الطلب، ليطابق مجموع ما يُحصَّل من الأجزاء إجماليَّ الطلب:
        // كوبون المتجر على طلب متجره فقط، والكوبون العام بنسبة قيمة المنتجات، والنقاط بنسبة قيمة كل جزء مع توصيله
        public static Dictionary<Guid, decimal> DiscountShares(decimal discount, decimal pointsDiscount, Guid? couponVendorId, IEnumerable<Line> lines)
        {
            var all = lines.ToList();
            var shares = all.ToDictionary(l => l.Id, _ => 0m);
            var active = all.Where(l => l.Status != OrderStatus.CANCELLED).OrderBy(l => l.Id).ToList();
            if (active.Count == 0 || discount <= 0) return shares;

            var points = Math.Clamp(pointsDiscount, 0, discount);
            var coupon = discount - points;

            var couponLines = couponVendorId.HasValue ? active.Where(l => l.VendorId == couponVendorId).ToList() : active;
            if (couponLines.Count == 0) couponLines = active;   // بيانات قديمة بلا متجر الكوبون
            Spread(shares, couponLines, coupon, l => l.Subtotal);
            Spread(shares, active, points, l => l.Subtotal + l.DeliveryFee);

            foreach (var l in active) shares[l.Id] = Math.Min(shares[l.Id], l.Subtotal + l.DeliveryFee);
            return shares;
        }

        private static void Spread(Dictionary<Guid, decimal> shares, List<Line> lines, decimal amount, Func<Line, decimal> weight)
        {
            if (amount <= 0 || lines.Count == 0) return;
            var totalWeight = lines.Sum(weight);
            var left = amount;
            for (var i = 0; i < lines.Count; i++)
            {
                // الأخير يأخذ الباقي فلا يضيع فرق التقريب
                var part = i == lines.Count - 1 ? left
                    : totalWeight > 0 ? Math.Round(amount * weight(lines[i]) / totalWeight, 2) : Math.Round(amount / lines.Count, 2);
                part = Math.Min(part, left);
                shares[lines[i].Id] += part;
                left -= part;
            }
        }
    }
}
