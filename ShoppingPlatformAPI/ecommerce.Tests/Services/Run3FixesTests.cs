using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.NotificationService;
using ecommerce.Services.OrderSettingsService;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ecommerce.Tests.Services
{
    // إصلاحات جولة الاختبار الثالثة (6 زبائن × 10 طلبات): نطاق واسط، حالة الطلب، الطلب الملغى، تأخر التأكيد
    public class Run3FixesTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

        public void Dispose() => _context.Dispose();

        [Theory]
        [InlineData(32.5051, 45.8243, true)]    // الكوت
        [InlineData(32.926, 44.776, true)]      // الصويرة
        [InlineData(33.106, 45.940, true)]      // بدرة
        [InlineData(32.173, 46.043, true)]      // الحي
        [InlineData(33.3152, 44.3661, false)]   // بغداد
        [InlineData(32.4637, 44.4196, false)]   // الحلة
        [InlineData(31.8356, 47.1440, false)]   // العمارة
        [InlineData(51.5, -0.12, false)]        // لندن
        public void ServiceArea_IsWasitOnly(double lat, double lng, bool inside) =>
            Assert.Equal(inside, ServiceArea.Covers((decimal)lat, (decimal)lng));

        [Fact]
        public void ServiceArea_AddressWithoutPin_IsNotJudged() => Assert.True(ServiceArea.Covers(null, null));

        [Fact]
        public void Rollup_StorePendingWhileOtherPrepares_IsPartiallyConfirmed()
        {
            // ORD-0024: متجر جاهز وآخر لم يؤكد — كان «قيد التحضير» فيختفي أن متجراً لم يرد
            Assert.Equal(OrderStatus.PARTIALLY_CONFIRMED,
                OrderStatusRollup.Compute(new[] { OrderStatus.READY, OrderStatus.PENDING_CONFIRMATION }));
            Assert.Equal(OrderStatus.PREPARING,
                OrderStatusRollup.Compute(new[] { OrderStatus.READY, OrderStatus.PREPARING }));
        }

        [Fact]
        public void FullyCancelled_ShowsPurchaseTotals_WhateverTheCancelOrder()
        {
            // ORD-0022: إلغاء جزء ثم الباقي كان يترك إجمالي الجزء الأخير فقط؛ الإلغاء المباشر يترك الكامل
            var order = new Order { Status = OrderStatus.CANCELLED, CouponOriginalAmount = 5_000, PointsRedeemedAmount = 1_000,
                Subtotal = 40_000, DeliveryFees = 3_500, DiscountAmount = 2_000, TotalAmount = 41_500, PaymentStatus = PaymentStatus.Pending };
            var subs = new[]
            {
                new SubOrder { Id = Guid.NewGuid(), Status = OrderStatus.CANCELLED, Subtotal = 45_000, DeliveryFee = 4_000 },
                new SubOrder { Id = Guid.NewGuid(), Status = OrderStatus.CANCELLED, Subtotal = 40_000, DeliveryFee = 3_500 },
            };

            OrderTotals.SyncCancelled(order, subs);

            Assert.Equal(85_000, order.Subtotal);
            Assert.Equal(7_500, order.DeliveryFees);
            Assert.Equal(6_000, order.DiscountAmount);
            Assert.Equal(86_500, order.TotalAmount);
            Assert.Equal(PaymentStatus.Cancelled, order.PaymentStatus);
            // أجزاؤه تحمل الخصم نفسه فيتطابق الجزء مع الطلب
            Assert.Equal(6_000, OrderTotals.DiscountShares(order, subs).Values.Sum());
        }

        [Fact]
        public void PartlyCancelled_OrWithCashCollected_IsLeftAlone()
        {
            var order = new Order { Status = OrderStatus.CANCELLED, TotalAmount = 3_500, CashCollectedAmount = 3_500 };
            OrderTotals.SyncCancelled(order, new[] { new SubOrder { Status = OrderStatus.CANCELLED, Subtotal = 20_000, DeliveryFee = 3_500 } });
            Assert.Equal(3_500, order.TotalAmount);   // أجرة رفض قُبضت: السجل المالي كما هو

            var open = new Order { Status = OrderStatus.READY, TotalAmount = 10_000 };
            OrderTotals.SyncCancelled(open, new[] { new SubOrder { Status = OrderStatus.READY, Subtotal = 99_000 } });
            Assert.Equal(10_000, open.TotalAmount);
        }

        [Fact]
        public async Task OverdueConfirmation_NotifiesStoreAndOpsOnce_AndKeepsOrderPending()
        {
            var now = new DateTimeOffset(2026, 10, 16, 20, 0, 0, TimeSpan.Zero);
            var vendor = new Vendor { Name = "Decor", NameAr = "الديكور" };
            var order = new Order { OrderNumber = "ORD-1" };
            var late = new SubOrder { OrderId = order.Id, VendorId = vendor.Id, SubOrderNumber = "ORD-1-V1",
                Status = SubOrderStatus.PendingConfirmation, ConfirmationDeadline = now.UtcDateTime.AddMinutes(-7) };
            var onTime = new SubOrder { OrderId = order.Id, VendorId = vendor.Id, SubOrderNumber = "ORD-1-V2",
                Status = SubOrderStatus.PendingConfirmation, ConfirmationDeadline = now.UtcDateTime.AddMinutes(3) };
            _context.AddRange(vendor, order, late, onTime);
            _context.SaveChanges();

            var notifications = new Mock<INotificationService>();
            var time = new Mock<TimeProvider>();
            time.Setup(t => t.GetUtcNow()).Returns(now);
            var notifier = new OverdueConfirmationNotifier(_context, notifications.Object, time.Object);

            Assert.Equal(1, await notifier.NotifyAsync());
            Assert.Equal(0, await notifier.NotifyAsync());   // مرة واحدة فقط

            notifications.Verify(n => n.NotifyVendorAsync(vendor.Id, It.IsAny<NotificationCategory>(), It.IsAny<string>(),
                It.Is<string>(m => m.Contains("ORD-1-V1") && m.Contains("7")), It.IsAny<object?>()), Times.Once);
            notifications.Verify(n => n.NotifyOpsAsync(It.IsAny<NotificationCategory>(), It.IsAny<string>(),
                It.Is<string>(m => m.Contains("ORD-1-V1")), It.IsAny<object?>()), Times.Once);
            Assert.Equal(SubOrderStatus.PendingConfirmation, (await _context.SubOrders.AsNoTracking().SingleAsync(s => s.Id == late.Id)).Status);
        }
    }
}
