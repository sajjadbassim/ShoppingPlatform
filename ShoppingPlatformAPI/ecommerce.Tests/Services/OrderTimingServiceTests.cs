using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.OrderSettingsService;
using ecommerce.Services.OrderTimingService;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ecommerce.Tests.Services
{
    // كم استغرق الطلب للوصول، ومدة كل مرحلة، ولون السرعة حسب حدود الإعدادات
    public class OrderTimingServiceTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly DateTime _t0 = new(2026, 10, 1, 9, 0, 0, DateTimeKind.Utc);

        public void Dispose() => _context.Dispose();
        private OrderTimingService Service() => new(_context);

        private void Log(SubOrder s, string status, int minute) =>
            _context.OrderStatusLogs.Add(new OrderStatusLog { SubOrderId = s.Id, OldStatus = "x", NewStatus = status, Reason = "", CreatedAt = _t0.AddMinutes(minute) });

        // طلب بمتجرين: الثاني أبطأ في التأكيد والتحضير — المرحلة تنتهي بآخر متجر
        private Order DeliveredOrder(bool withPickup)
        {
            var order = new Order { OrderNumber = "ORD-T", Status = OrderStatus.DELIVERED, CreatedAt = _t0 };
            var a = new SubOrder { OrderId = order.Id, SubOrderNumber = "A", Status = OrderStatus.DELIVERED, ConfirmedAt = _t0.AddMinutes(2), PickedUpAt = withPickup ? _t0.AddMinutes(40) : null };
            var b = new SubOrder { OrderId = order.Id, SubOrderNumber = "B", Status = OrderStatus.DELIVERED, ConfirmedAt = _t0.AddMinutes(5), PickedUpAt = withPickup ? _t0.AddMinutes(44) : null };
            _context.AddRange(order, a, b);
            Log(a, OrderStatus.PREPARING, 6); Log(b, OrderStatus.PREPARING, 8);
            Log(a, OrderStatus.OUT_FOR_DELIVERY, 30); Log(b, OrderStatus.OUT_FOR_DELIVERY, 30);
            Log(a, OrderStatus.DELIVERED, 62); Log(b, OrderStatus.DELIVERED, 62);
            _context.SaveChanges();
            return order;
        }

        [Fact]
        public async Task DeliveredOrder_TotalAndStages()
        {
            var order = DeliveredOrder(withPickup: true);
            var t = (await Service().GetTimingsAsync(new[] { order.Id }))[order.Id];

            Assert.True(t.IsDelivered);
            Assert.Equal(62, t.TotalMinutes);
            Assert.Equal("normal", t.Speed);                 // الافتراضي: ≤45 سريع، ≥90 بطيء
            Assert.Equal(new[] { "confirm", "start", "prepare", "pickup", "ride" }, t.Stages.Select(s => s.Key));
            Assert.Equal(new double[] { 5, 3, 22, 14, 18 }, t.Stages.Select(s => s.Minutes));
            Assert.Equal("التحضير وإسناد السائق", t.SlowestStage);
            Assert.True(t.PickupRecorded);
        }

        [Fact]
        public async Task WithoutPickupTime_RideCoversPickupToo()
        {
            var order = DeliveredOrder(withPickup: false);
            var t = (await Service().GetTimingsAsync(new[] { order.Id }))[order.Id];

            Assert.Equal("ride", t.Stages.Last().Key);
            Assert.Equal(32, t.Stages.Last().Minutes);      // من الإسناد (30) حتى التسليم (62)
            Assert.False(t.PickupRecorded);
        }

        [Fact]
        public async Task Thresholds_FromAdminSettings_ColorTheOrder()
        {
            var order = DeliveredOrder(withPickup: true);   // 62 دقيقة
            await new OrderSettingsService(_context).SetDeliveryThresholdsAsync(20, 60, Guid.NewGuid());
            Assert.Equal("slow", (await Service().GetTimingsAsync(new[] { order.Id }))[order.Id].Speed);

            await new OrderSettingsService(_context).SetDeliveryThresholdsAsync(70, 120, Guid.NewGuid());
            Assert.Equal("fast", (await Service().GetTimingsAsync(new[] { order.Id }))[order.Id].Speed);
        }

        [Fact]
        public async Task InvalidThresholds_AreRejected()
        {
            var settings = new OrderSettingsService(_context);
            await Assert.ThrowsAsync<ecommerce.Core.Exceptions.BusinessRuleException>(() => settings.SetDeliveryThresholdsAsync(60, 60, Guid.NewGuid()));
            await Assert.ThrowsAsync<ecommerce.Core.Exceptions.BusinessRuleException>(() => settings.SetDeliveryThresholdsAsync(2, 30, Guid.NewGuid()));
            Assert.Equal((45, 90), await Service().GetThresholdsAsync());
        }

        [Fact]
        public async Task ActiveOrder_HasElapsedNotTotal()
        {
            var order = new Order { OrderNumber = "ORD-A", Status = OrderStatus.PREPARING, CreatedAt = DateTime.UtcNow.AddMinutes(-20) };
            _context.Orders.Add(order); _context.SaveChanges();
            var t = (await Service().GetTimingsAsync(new[] { order.Id }))[order.Id];

            Assert.False(t.IsDelivered);
            Assert.Null(t.TotalMinutes);
            Assert.Null(t.Speed);
            Assert.InRange(t.ElapsedMinutes!.Value, 19, 22);
        }
    }
}
