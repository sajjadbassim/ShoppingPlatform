using ecommerce.Core.Constants;
using Xunit;

namespace ecommerce.Tests.Services
{
    public class OrderStatusTextTests
    {
        [Theory]
        [InlineData(OrderStatus.DELIVERED, "تم التوصيل")]
        [InlineData(OrderStatus.OUT_FOR_DELIVERY, "في الطريق")]
        [InlineData(OrderStatus.PENDING_CONFIRMATION, "بانتظار التأكيد")]
        public void Ar_TranslatesStatusCodes(string status, string expected) =>
            Assert.Equal(expected, OrderStatusText.Ar(status));

        [Theory]
        [InlineData(OrderStatus.CONFIRMED)]
        [InlineData(OrderStatus.PREPARING)]
        [InlineData(OrderStatus.OUT_FOR_DELIVERY)]
        [InlineData(OrderStatus.DELIVERED)]
        [InlineData(OrderStatus.CANCELLED)]
        public void CustomerMessage_HasOrderNumber_AndNoStatusCode(string status)
        {
            var message = OrderStatusText.CustomerMessage(status, "ORD-20260930-0001");
            Assert.Contains("ORD-20260930-0001", message);
            Assert.DoesNotContain(status, message);
        }

        [Theory]
        [InlineData(OrderStatus.PREPARING, "بدأ تحضير")]
        [InlineData(OrderStatus.OUT_FOR_DELIVERY, "خرج للتوصيل")]
        [InlineData(OrderStatus.DELIVERED, "تم توصيل")]
        public void StaffMessage_SaysWhatHappened_WithoutFromTo(string status, string expected)
        {
            var message = OrderStatusText.StaffMessage(status, "ORD-20260930-0001-V1");
            Assert.Contains(expected, message);
            Assert.Contains("ORD-20260930-0001-V1", message);
            Assert.DoesNotContain(" من ", message);
            Assert.DoesNotContain(status, message);
        }
    }
}
