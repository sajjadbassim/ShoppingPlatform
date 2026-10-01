using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.OrderSettingsService;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ecommerce.Tests.Services
{
    public class OrderSettingsServiceTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

        public void Dispose() => _context.Dispose();
        private OrderSettingsService Service() => new(_context);

        [Fact]
        public async Task Timeout_DefaultsToFive_AndAdminCanChangeWithinBounds()
        {
            Assert.Equal(5, await Service().GetConfirmationTimeoutAsync());

            await Service().SetConfirmationTimeoutAsync(15, Guid.NewGuid());
            Assert.Equal(15, await Service().GetConfirmationTimeoutAsync());

            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().SetConfirmationTimeoutAsync(0, Guid.NewGuid()));
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().SetConfirmationTimeoutAsync(241, Guid.NewGuid()));
            Assert.Equal(15, await Service().GetConfirmationTimeoutAsync());
        }

        [Fact]
        public async Task Overdue_ListsOnlyUnconfirmedPastDeadline_OldestFirst()
        {
            var customer = new User { FullName = "زبون", Phone = "0770" };
            var vendor = new Vendor { Name = "Store", NameAr = "متجر", Phone = "0780" };
            var order = new Order { OrderNumber = "ORD-1", CustomerId = customer.Id };
            SubOrder Sub(string n, string status, int deadlineMinutes) => new()
            {
                OrderId = order.Id, VendorId = vendor.Id, SubOrderNumber = n, Status = status,
                Subtotal = 10_000, DeliveryFee = 2_000, ConfirmationDeadline = DateTime.UtcNow.AddMinutes(deadlineMinutes),
            };
            _context.AddRange(customer, vendor, order,
                Sub("late-10", SubOrderStatus.PendingConfirmation, -10),
                Sub("late-2", SubOrderStatus.PendingConfirmation, -2),
                Sub("still-time", SubOrderStatus.PendingConfirmation, 3),
                Sub("confirmed-late", SubOrderStatus.Confirmed, -30));
            _context.SaveChanges();

            var overdue = await Service().GetOverdueConfirmationsAsync();

            Assert.Equal(new[] { "late-10", "late-2" }, overdue.Select(o => o.SubOrderNumber));
            Assert.True(overdue[0].MinutesOverdue >= 10);
            Assert.Equal("متجر", overdue[0].VendorName);
            Assert.Equal(12_000, overdue[0].Total);
        }
    }
}
