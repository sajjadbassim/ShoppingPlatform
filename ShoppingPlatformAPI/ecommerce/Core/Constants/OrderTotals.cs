using ecommerce.Core.Models;

namespace ecommerce.Core.Constants
{
    // إجماليات الطلب ونصيب كل طلب فرعي من الخصم.
    // - النصيب يُحفظ على الطلب الفرعي (CouponShare/PointsShare) فيقرأ السائق والفاتورة والتقارير الرقم نفسه.
    // - الجزء الذي خرج مع السائق (أو سُلّم/تعذّر تسليمه) نصيبه مجمَّد: السائق عرف ما سيقبضه، والزبون ربما دفع.
    // - سقوط جزء (رفض/إلغاء/عدم توفر/إرجاع للمتجر): كوبون النسبة يُعاد حسابه على ما بقي، والكوبون الثابت
    //   لا يزيد عن الأصلي ولا عن قيمة الباقي؛ ما لا يجد جزءاً مفتوحاً يحمله يسقط.
    // - النقاط (قرار 2026-10-17): كل جزء يحمل نصيبه الذي وُزّع عليه عند استخدامها فقط — لا ينتقل إليه نصيب
    //   جزء سقط. نصيب الجزء الساقط (أو القطع التي أزالها المتجر) يعود لرصيد الزبون (UnusedPoints)،
    //   فيدفع الزبون عن الباقي ما رآه عند الطلب.
    // - الجزء الذي تعذّر تسليمه لا يُحسب على الزبون من لحظة الفشل (لا انتظار لاستلام المتجر)؛ نصيبه يسقط.
    // - الرفض عند الباب: الخصم على ما احتفظ به الزبون فقط (Kept) — القطع المرفوضة تأخذ نصيبها معها،
    //   وإجمالي الطلب = ما دفعه الزبون فعلاً (المرفوض يُعرض منفصلاً، و«قيمة الطلب عند الشراء» في OriginalTotalAmount).
    // - الطلب الملغى بالكامل يحتفظ بإجمالياته الأصلية للسجل.
    public static class OrderTotals
    {
        public static bool IsFrozen(SubOrder s) =>
            s.Status is OrderStatus.OUT_FOR_DELIVERY or OrderStatus.DELIVERED;

        // جزء يدفع الزبون عنه: لا ملغى ولا تعذّر تسليمه
        public static bool Counts(SubOrder s) => s.Status != OrderStatus.CANCELLED && s.Status != OrderStatus.DELIVERY_FAILED;

        // قيمة ما احتفظ به الزبون من الجزء (بلا المرفوض عند الباب)
        public static decimal Kept(SubOrder s) => Math.Max(0, s.Subtotal - s.RefusedAmount);

        public static bool Recalculate(Order order, IEnumerable<SubOrder> subOrders)
        {
            var subs = subOrders.ToList();
            EnsureShares(order, subs);

            var active = subs.Where(Counts).ToList();
            if (active.Count == 0) return false;
            foreach (var s in subs.Where(s => !Counts(s)))
            {
                s.CouponShare = 0;
                s.PointsShare = 0;
            }

            var frozen = active.Where(IsFrozen).ToList();
            var open = active.Where(s => !IsFrozen(s)).OrderBy(s => s.Id).ToList();

            // الكوبون: المستحق الآن على ما بقي، المجمَّد يبقى كما هو، والفرق يتوزّع على المفتوح
            var couponLines = active.Where(s => order.CouponVendorId == null || s.VendorId == order.CouponVendorId).ToList();
            var couponTarget = CouponFor(order, couponLines.Sum(Kept));
            var couponOpen = open.Where(s => order.CouponVendorId == null || s.VendorId == order.CouponVendorId).ToList();
            foreach (var s in couponOpen) s.CouponShare = 0;
            Spread(couponOpen, Math.Max(0, couponTarget - frozen.Sum(s => s.CouponShare)), Kept,
                (s, v) => s.CouponShare = Math.Min(v, Kept(s)));

            // النقاط: كل جزء مفتوح يبقى على نصيبه (لا يأخذ نصيب ما سقط)، ولا يزيد عن مستحقه بعد الكوبون —
            // الفرق يظهر في UnusedPoints ويُعاد للزبون
            foreach (var s in open) s.PointsShare = Math.Min(s.PointsShare, Math.Max(0, Kept(s) + FeeDue(s) - s.CouponShare));

            var subtotal = active.Sum(Kept);
            var fees = active.Sum(FeeDue);
            var points = active.Sum(s => s.PointsShare);
            var discount = active.Sum(s => s.CouponShare) + points;
            var total = active.Sum(DueFor);
            if (order.Subtotal == subtotal && order.DeliveryFees == fees && order.DiscountAmount == discount
                && order.PointsDiscountAmount == points && order.TotalAmount == total) return false;

            order.Subtotal = subtotal;
            order.DeliveryFees = fees;
            order.DiscountAmount = discount;
            order.PointsDiscountAmount = points;
            order.TotalAmount = total;
            order.UpdatedAt = DateTime.UtcNow;
            return true;
        }

        // أجرة توصيل الجزء المستحقة على الزبون
        public static decimal FeeDue(SubOrder s) => s.RefusalFeeWaived ? 0 : s.DeliveryFee;

        // ما يدفعه الزبون عن هذا الجزء: ما احتفظ به + أجرته − نصيبه من الخصم
        public static decimal DueFor(SubOrder s) =>
            !Counts(s) ? 0 : Math.Max(0, Kept(s) + FeeDue(s) - s.CouponShare - s.PointsShare);

        // نصيب القطع المرفوضة الآن من خصم جزئها (بنسبة قيمتها مما بقي) — يخرج من الجزء معها
        public static (decimal Coupon, decimal Points) RefusedShare(SubOrder s, decimal refusedValue)
        {
            var kept = Kept(s);
            if (kept <= 0 || refusedValue <= 0) return (0, 0);
            var ratio = Math.Min(1, refusedValue / kept);
            return (Math.Round(s.CouponShare * ratio), Math.Round(s.PointsShare * ratio));
        }

        // استخدام نقاط على الطلب: قيمتها تتوزّع على الأجزاء المفتوحة (التي لم تخرج مع السائق) بنسبة مستحق كل جزء.
        // يُستدعى قبل Recalculate
        public static void SpreadPoints(Order order, IEnumerable<SubOrder> subOrders, decimal amount)
        {
            var subs = subOrders.ToList();
            EnsureShares(order, subs);
            var open = subs.Where(s => Counts(s) && !IsFrozen(s)).OrderBy(s => s.Id).ToList();
            Spread(open, amount, s => Kept(s) + FeeDue(s),
                (s, v) => s.PointsShare += Math.Min(v, Math.Max(0, Kept(s) + FeeDue(s) - s.CouponShare - s.PointsShare)));
        }

        // نصيب قطع أزالها المتجر (غير متوفرة) من نقاط جزئها: يخرج معها ويعود للزبون — قبل Recalculate
        public static void ReducePointsForRemoved(SubOrder s, decimal keptBefore)
        {
            var keptNow = Kept(s);
            if (s.PointsShare <= 0 || keptBefore <= 0 || keptNow >= keptBefore) return;
            s.PointsShare = Math.Round(s.PointsShare * keptNow / keptBefore);
        }

        // قيمة النقاط المستبدلة التي لم يعد لها جزء يحملها (سقط جزؤها أو أزال المتجر قطعها) — تُعاد للزبون
        public static decimal UnusedPoints(Order order) => Math.Max(0, order.PointsRedeemedAmount - order.PointsDiscountAmount);

        // جملة للزبون حين تعود له نقاط جزء سقط
        public static string PointsReturnedNote(decimal value) =>
            value > 0 ? $"، وأُعيدت نقاط هذا الجزء ({value:N0} د.ع) إلى رصيدك" : "";

        // الدفع عند الاستلام: الطلب مدفوع حين يكتمل (كل ما لم يُلغَ سُلّم) وقبض السائق نقداً.
        // يُستدعى من كل مسار يغيّر حالة الطلب (التسليم، واستلام المتجر لبضاعة تعذّر تسليمها)
        public static void SyncPayment(Order order)
        {
            if (order.PaymentMethod == PaymentMethods.COD && order.Status == OrderStatus.DELIVERED && order.CashCollectedAmount > 0)
                order.PaymentStatus = PaymentStatus.Paid;
        }

        // الطلب أُلغي كله (من أي مسار): يعرض قيمته عند الشراء للسجل — لا ما بقي بعد إلغاءات جزئية سبقته،
        // فيظهر الطلب الملغى بالرقم نفسه مهما كان ترتيب الإلغاء — ولا دفع مستحق عليه.
        // ما قُبض منه نقداً (أجرة رفض) يبقى كما هو
        public static void SyncCancelled(Order order, IEnumerable<SubOrder> subOrders)
        {
            var subs = subOrders.ToList();
            if (order.Status != OrderStatus.CANCELLED || subs.Count == 0 || subs.Any(s => s.Status != OrderStatus.CANCELLED)) return;
            if ((order.CashCollectedAmount ?? 0) > 0) return;

            order.Subtotal = subs.Sum(s => s.Subtotal);
            order.DeliveryFees = subs.Sum(s => s.DeliveryFee);
            order.PointsDiscountAmount = order.PointsRedeemedAmount;
            order.DiscountAmount = Math.Min(order.CouponOriginalAmount + order.PointsRedeemedAmount, order.Subtotal + order.DeliveryFees);
            order.TotalAmount = order.Subtotal + order.DeliveryFees - order.DiscountAmount;
            if (order.PaymentStatus != PaymentStatus.Paid) order.PaymentStatus = PaymentStatus.Cancelled;
            order.UpdatedAt = DateTime.UtcNow;
        }

        public static decimal CouponDiscount(Order order) => Math.Max(0, order.DiscountAmount - order.PointsDiscountAmount);

        // نصيب كل طلب فرعي من خصم الطلب (المحفوظ)
        public static Dictionary<Guid, decimal> DiscountShares(Order order, IEnumerable<SubOrder> subOrders)
        {
            var subs = subOrders.ToList();
            if (subs.All(s => s.CouponShare == 0 && s.PointsShare == 0) && order.DiscountAmount > 0)
            {
                // طلب لم تُحفظ له أنصبة (قديم أو بيانات اختبار): يُحسب على نسخة كي لا يتغيّر الكيان المتتبَّع
                var copies = subs.Select(s => new SubOrder { Id = s.Id, VendorId = s.VendorId, Status = s.Status, Subtotal = s.Subtotal, DeliveryFee = s.DeliveryFee }).ToList();
                var copyOrder = new Order { DiscountAmount = order.DiscountAmount, PointsDiscountAmount = order.PointsDiscountAmount, CouponVendorId = order.CouponVendorId };
                EnsureShares(copyOrder, copies);
                subs = copies;
            }
            // الطلب الملغى كله: خصمه (المعروض للسجل) موزّع على أجزائه فيتطابق الجزء مع الطلب
            if (order.Status == OrderStatus.CANCELLED && order.DiscountAmount > 0 && subs.Count > 0 && subs.All(s => !Counts(s)))
            {
                var copies = subs.Select(s => new SubOrder { Id = s.Id, Subtotal = s.Subtotal, DeliveryFee = s.DeliveryFee }).OrderBy(s => s.Id).ToList();
                Spread(copies, order.DiscountAmount, s => s.Subtotal + s.DeliveryFee, (s, v) => s.CouponShare = Math.Min(v, s.Subtotal + s.DeliveryFee));
                return copies.ToDictionary(s => s.Id, s => s.CouponShare);
            }
            return subs.ToDictionary(s => s.Id, s => !Counts(s) ? 0 : s.CouponShare + s.PointsShare);
        }

        // خصم الكوبون المستحق على قيمة منتجات مشمولة بالكوبون
        private static decimal CouponFor(Order order, decimal eligible)
        {
            if (eligible <= 0 || order.CouponOriginalAmount <= 0) return 0;
            if (order.CouponDiscountType == DiscountType.PERCENTAGE && order.CouponDiscountValue is decimal pct)
            {
                var amount = Math.Round(eligible * pct / 100, 2);
                return order.CouponMaxDiscount is decimal max ? Math.Min(amount, max) : amount;
            }
            return Math.Min(order.CouponOriginalAmount, eligible);
        }

        // طلب بلا أنصبة محفوظة: يُوزَّع الخصم الحالي (الكوبون على متجره أو بنسبة المنتجات، والنقاط بنسبة الجزء مع توصيله)
        private static void EnsureShares(Order order, List<SubOrder> subs)
        {
            if (order.CouponOriginalAmount == 0 && order.PointsRedeemedAmount == 0 && order.DiscountAmount > 0)
            {
                order.PointsRedeemedAmount = Math.Clamp(order.PointsDiscountAmount, 0, order.DiscountAmount);
                order.CouponOriginalAmount = order.DiscountAmount - order.PointsRedeemedAmount;
            }
            if (subs.Any(s => s.CouponShare != 0 || s.PointsShare != 0)) return;

            var active = subs.Where(s => s.Status != OrderStatus.CANCELLED).OrderBy(s => s.Id).ToList();
            var coupon = Math.Max(0, order.DiscountAmount - order.PointsDiscountAmount);
            var couponLines = order.CouponVendorId.HasValue ? active.Where(s => s.VendorId == order.CouponVendorId).ToList() : active;
            if (couponLines.Count == 0) couponLines = active;   // بيانات قديمة بلا متجر الكوبون
            Spread(couponLines, coupon, s => s.Subtotal, (s, v) => s.CouponShare = v);
            Spread(active, Math.Clamp(order.PointsDiscountAmount, 0, order.DiscountAmount), s => s.Subtotal + s.DeliveryFee, (s, v) => s.PointsShare = v);
            foreach (var s in active)
                if (s.CouponShare + s.PointsShare > s.Subtotal + s.DeliveryFee)
                    s.PointsShare = Math.Max(0, s.Subtotal + s.DeliveryFee - s.CouponShare);
        }

        private static void Spread(List<SubOrder> lines, decimal amount, Func<SubOrder, decimal> weight, Action<SubOrder, decimal> set)
        {
            if (amount <= 0 || lines.Count == 0) return;
            var totalWeight = lines.Sum(weight);
            var left = amount;
            for (var i = 0; i < lines.Count; i++)
            {
                // الأخير يأخذ الباقي فلا يضيع فرق التقريب
                var part = i == lines.Count - 1 ? left
                    : totalWeight > 0 ? Math.Round(amount * weight(lines[i]) / totalWeight) : Math.Round(amount / lines.Count);   // دينار كامل
                part = Math.Min(part, left);
                set(lines[i], part);
                left -= part;
            }
        }
    }
}
