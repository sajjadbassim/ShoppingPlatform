using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using Xunit;

namespace ecommerce.Tests.Services
{
    // نصيب كل جزء من الخصم بعد سقوط جزء من الطلب — سيناريوهات اختبار الوكلاء (ORD-0006 / 0015 / 0016)
    public class OrderTotalsSharesTests
    {
        private static readonly Guid V1 = Guid.NewGuid(), V2 = Guid.NewGuid();

        private static (Order Order, SubOrder A, SubOrder B) NewOrder(decimal a, decimal feeA, decimal b, decimal feeB,
            string? type, decimal? value, decimal coupon)
        {
            var order = new Order
            {
                CouponCode = "X", CouponDiscountType = type, CouponDiscountValue = value,
                CouponOriginalAmount = coupon, DiscountAmount = coupon,
            };
            var sa = new SubOrder { Id = Guid.NewGuid(), VendorId = V1, Status = OrderStatus.PENDING_CONFIRMATION, Subtotal = a, DeliveryFee = feeA };
            var sb = new SubOrder { Id = Guid.NewGuid(), VendorId = V2, Status = OrderStatus.PENDING_CONFIRMATION, Subtotal = b, DeliveryFee = feeB };
            OrderTotals.Recalculate(order, new[] { sa, sb });
            return (order, sa, sb);
        }

        [Fact]
        public void PercentageCoupon_StoreRejects_DiscountShrinksToRemainingGoods()
        {
            // ORD-0006: QA10 على 49,500؛ رفض متجر 23,400 → الخصم 10% من 26,100 فقط
            var (order, a, b) = NewOrder(26_100, 4_000, 23_400, 3_500, DiscountType.PERCENTAGE, 10, 4_950);
            Assert.Equal(4_950, a.CouponShare + b.CouponShare);

            b.Status = OrderStatus.CANCELLED;
            OrderTotals.Recalculate(order, new[] { a, b });

            Assert.Equal(2_610, a.CouponShare);
            Assert.Equal(0, b.CouponShare);
            Assert.Equal(27_490, order.TotalAmount);
            Assert.Equal(27_490, OrderTotals.DueFor(a));
        }

        [Fact]
        public void PercentageCoupon_ItemUnavailable_DiscountFollowsNewSubtotal()
        {
            // ORD-0016: 36,000 بخصم 3,600؛ قطعة غير متوفرة → 24,300 والخصم 2,430
            var order = new Order { CouponDiscountType = DiscountType.PERCENTAGE, CouponDiscountValue = 10, CouponOriginalAmount = 3_600, DiscountAmount = 3_600 };
            var s = new SubOrder { Id = Guid.NewGuid(), VendorId = V1, Status = OrderStatus.PENDING_CONFIRMATION, Subtotal = 36_000, DeliveryFee = 3_000 };
            OrderTotals.Recalculate(order, new[] { s });

            s.Subtotal = 24_300;
            OrderTotals.Recalculate(order, new[] { s });

            Assert.Equal(2_430, order.DiscountAmount);
            Assert.Equal(24_870, order.TotalAmount);
        }

        [Fact]
        public void FixedCoupon_DeliveredPartKeepsItsShare_WhenOtherPartFails()
        {
            // ORD-0015: QAFIX 2,000 مقسوم 680/1,320؛ الأول سُلّم وقُبض ثمنه، الثاني تعذّر تسليمه ثم أُلغي
            var (order, a, b) = NewOrder(15_000, 3_500, 29_000, 4_000, DiscountType.FIXED, 2_000, 2_000);
            Assert.Equal(2_000, a.CouponShare + b.CouponShare);
            var paidForA = OrderTotals.DueFor(a);

            a.Status = OrderStatus.DELIVERED;
            b.Status = OrderStatus.DELIVERY_FAILED;
            OrderTotals.Recalculate(order, new[] { a, b });
            b.Status = OrderStatus.CANCELLED;
            OrderTotals.Recalculate(order, new[] { a, b });

            Assert.Equal(paidForA, OrderTotals.DueFor(a));   // ما دفعه الزبون لا يتغيّر
            Assert.Equal(paidForA, order.TotalAmount);
            Assert.Equal(a.CouponShare, order.DiscountAmount);   // نصيب الجزء الفاشل سقط (لا جزء مفتوح يحمله)
        }

        [Fact]
        public void FixedCoupon_CancelledBeforeDispatch_ShareMovesToOpenPart()
        {
            var (order, a, b) = NewOrder(15_000, 3_500, 29_000, 4_000, DiscountType.FIXED, 2_000, 2_000);
            b.Status = OrderStatus.CANCELLED;
            OrderTotals.Recalculate(order, new[] { a, b });

            Assert.Equal(2_000, a.CouponShare);
            Assert.Equal(16_500, order.TotalAmount);
        }

        [Fact]
        public void Points_PartCancelledAfterOthersDispatched_AreReportedUnused()
        {
            var (order, a, b) = NewOrder(15_000, 3_500, 29_000, 4_000, null, null, 0);
            order.PointsRedeemedAmount = 1_000;
            OrderTotals.SpreadPoints(order, new[] { a, b }, 1_000);
            OrderTotals.Recalculate(order, new[] { a, b });
            Assert.Equal(1_000, a.PointsShare + b.PointsShare);

            a.Status = OrderStatus.OUT_FOR_DELIVERY;
            b.Status = OrderStatus.CANCELLED;
            OrderTotals.Recalculate(order, new[] { a, b });

            Assert.Equal(a.PointsShare, order.PointsDiscountAmount);
            Assert.Equal(1_000 - a.PointsShare, OrderTotals.UnusedPoints(order));   // تُعاد للزبون
        }

        [Fact]
        public void Points_StoreCancelsItsPart_RemainingPartKeepsOnlyItsOwnShare()
        {
            // قرار 2026-10-17 (الخيار ب): حذاء 20,000 + ساعة 20,000، نقاط 4,000 (2,000 لكل جزء). ألغى متجر الأحذية:
            // الساعة تبقى بخصمها هي (18,000 + التوصيل) ونقاط الحذاء تعود للزبون — لا تنتقل للساعة
            var (order, shoes, watch) = NewOrder(20_000, 0, 20_000, 0, null, null, 0);
            order.PointsRedeemedAmount = 4_000;
            OrderTotals.SpreadPoints(order, new[] { shoes, watch }, 4_000);
            OrderTotals.Recalculate(order, new[] { shoes, watch });
            Assert.Equal(2_000, shoes.PointsShare);
            Assert.Equal(2_000, watch.PointsShare);

            shoes.Status = OrderStatus.CANCELLED;
            OrderTotals.Recalculate(order, new[] { shoes, watch });

            Assert.Equal(2_000, watch.PointsShare);
            Assert.Equal(18_000, order.TotalAmount);
            Assert.Equal(2_000, OrderTotals.UnusedPoints(order));   // تُعاد لرصيد الزبون
        }

        [Fact]
        public void Points_StoreRemovesUnavailableItems_TheirShareReturns()
        {
            var (order, a, b) = NewOrder(20_000, 0, 20_000, 0, null, null, 0);
            order.PointsRedeemedAmount = 4_000;
            OrderTotals.SpreadPoints(order, new[] { a, b }, 4_000);
            OrderTotals.Recalculate(order, new[] { a, b });

            var keptBefore = OrderTotals.Kept(a);
            a.Subtotal = 10_000;   // أزال المتجر نصف القطع
            OrderTotals.ReducePointsForRemoved(a, keptBefore);
            OrderTotals.Recalculate(order, new[] { a, b });

            Assert.Equal(1_000, a.PointsShare);
            Assert.Equal(2_000, b.PointsShare);
            Assert.Equal(1_000, OrderTotals.UnusedPoints(order));
        }

        [Fact]
        public void SyncPayment_MarksDeliveredCodOrderPaid()
        {
            var order = new Order { PaymentMethod = PaymentMethods.COD, PaymentStatus = PaymentStatus.Pending, Status = OrderStatus.DELIVERED, CashCollectedAmount = 18_120 };
            OrderTotals.SyncPayment(order);
            Assert.Equal(PaymentStatus.Paid, order.PaymentStatus);
        }
    }
}
