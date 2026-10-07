using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services;
using ecommerce.Services.FileService;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ecommerce.Core.Exceptions;

namespace ecommerce.Tests.Services
{
    // رد البائع على تقييم: نشر، تعديل بلا إشعار مكرر، حذف
    public class VendorReplyTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly Mock<INotificationService> _notifications = new();
        private readonly Review _review;

        public VendorReplyTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

            var store = new Vendor { Name = "s", NameAr = "s", OwnerId = Guid.NewGuid() };
            var product = new Product { VendorId = store.Id, Name = "p", NameAr = "p", Price = 10 };
            var user = new User { FullName = "زبون", Email = "c@x", Role = "CUSTOMER" };
            _review = new Review { ProductId = product.Id, UserId = user.Id, OrderId = Guid.NewGuid(), Rating = 2, Body = "تأخر" };
            _context.AddRange(store, product, user, _review);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private ReviewService Service() => new(new ReviewRepository(_context), new Mock<IFileService>().Object, _context,
            _notifications.Object, new Mock<ILoyaltyService>().Object, NullLogger<ReviewService>.Instance);

        [Fact]
        public async Task Reply_SavesTextAndNotifiesCustomerOnce()
        {
            var dto = await Service().SetVendorReplyAsync(_review.Id, "  نعتذر، سنعوضك  ");
            Assert.Equal("نعتذر، سنعوضك", dto.VendorReply);
            Assert.NotNull(dto.VendorReplyAt);

            await Service().SetVendorReplyAsync(_review.Id, "نعتذر جداً");   // تعديل
            Assert.Equal("نعتذر جداً", (await _context.Reviews.FindAsync(_review.Id))!.VendorReply);

            _notifications.Verify(n => n.NotifyCustomerAsync(_review.UserId, It.IsAny<string>(), It.IsAny<object?>()), Times.Once);
        }

        [Fact]
        public async Task EmptyReply_RemovesIt()
        {
            await Service().SetVendorReplyAsync(_review.Id, "شكراً");
            var dto = await Service().SetVendorReplyAsync(_review.Id, null);

            Assert.Null(dto.VendorReply);
            Assert.Null(dto.VendorReplyAt);
        }

        [Fact]
        public async Task TooLongReply_IsRejected()
        {
            await Assert.ThrowsAnyAsync<AppException>(() => Service().SetVendorReplyAsync(_review.Id, new string('x', 1001)));
        }
    }
}
