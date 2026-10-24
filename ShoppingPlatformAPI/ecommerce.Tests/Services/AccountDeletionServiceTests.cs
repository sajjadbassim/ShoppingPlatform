using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ecommerce.Tests.Services
{
    public class AccountDeletionServiceTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly Mock<IAvatarService> _avatars = new();
        private const string Password = "secret12";

        public void Dispose() => _context.Dispose();

        private AccountDeletionService Service() => new(_context, _avatars.Object);

        private async Task<User> AddUser(string role = UserRoles.Customer, bool hasPassword = true)
        {
            var user = new User
            {
                FullName = "زبون", Email = "a@b.com", Phone = "07701234567", Role = role,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(Password), HasPassword = hasPassword,
                GoogleId = "g-1", ReferralCode = "ABC123",
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            return user;
        }

        [Fact]
        public async Task Delete_AnonymizesAndDeactivates_KeepsOrderAddress()
        {
            var user = await AddUser();
            var address = new Address { UserId = user.Id, Label = "المنزل", StreetAddress = "شارع 1", City = "الكوت", Phone = "0770", Notes = "ن", Latitude = 1, Longitude = 2 };
            _context.Addresses.Add(address);
            _context.Wishlists.Add(new Wishlist { UserId = user.Id });
            _context.DeviceTokens.Add(new DeviceToken { UserId = user.Id, Token = "fcm-1", Platform = "android", App = "customer" });
            await _context.SaveChangesAsync();

            await Service().DeleteOwnAccountAsync(user.Id, Password);

            var saved = await _context.Users.FirstAsync(u => u.Id == user.Id);
            Assert.False(saved.IsActive);
            Assert.Equal(AccountDeletionService.DeletedName, saved.FullName);
            Assert.Null(saved.Phone);
            Assert.Null(saved.GoogleId);
            Assert.Null(saved.ReferralCode);
            Assert.StartsWith("deleted-", saved.Email);
            Assert.NotNull(saved.SessionsRevokedAt);

            var addr = await _context.Addresses.FirstAsync(a => a.Id == address.Id);   // العنوان باقٍ لأن الطلبات تشير إليه
            Assert.Null(addr.Phone);
            Assert.Null(addr.Latitude);
            Assert.Equal(AccountDeletionService.DeletedName, addr.Label);
            Assert.Empty(_context.Wishlists.Where(w => w.UserId == user.Id));
            Assert.Empty(_context.DeviceTokens.Where(d => d.UserId == user.Id));
        }

        [Fact]
        public async Task Delete_WrongPassword_Throws_AndKeepsAccount()
        {
            var user = await AddUser();
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().DeleteOwnAccountAsync(user.Id, "wrong"));
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().DeleteOwnAccountAsync(user.Id, null));
            Assert.True((await _context.Users.FirstAsync(u => u.Id == user.Id)).IsActive);
        }

        [Fact]
        public async Task Delete_GoogleAccountWithoutPassword_NeedsNoPassword()
        {
            var user = await AddUser(hasPassword: false);
            await Service().DeleteOwnAccountAsync(user.Id, null);
            Assert.False((await _context.Users.FirstAsync(u => u.Id == user.Id)).IsActive);
        }

        [Theory]
        [InlineData(UserRoles.Vendor)]
        [InlineData(UserRoles.Driver)]
        [InlineData(UserRoles.Admin)]
        [InlineData(UserRoles.Ops)]
        public async Task Delete_NonCustomer_Throws(string role)
        {
            var user = await AddUser(role);
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().DeleteOwnAccountAsync(user.Id, Password));
        }

        [Fact]
        public async Task Delete_WithActiveOrder_Throws_ButFinishedOrdersAreFine()
        {
            var user = await AddUser();
            _context.Orders.Add(new Order { CustomerId = user.Id, OrderNumber = "O-1", Status = OrderStatus.DELIVERED });
            await _context.SaveChangesAsync();
            _context.Orders.Add(new Order { CustomerId = user.Id, OrderNumber = "O-2", Status = OrderStatus.PREPARING });
            await _context.SaveChangesAsync();

            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().DeleteOwnAccountAsync(user.Id, Password));

            var active = await _context.Orders.FirstAsync(o => o.OrderNumber == "O-2");
            active.Status = OrderStatus.CANCELLED;
            await _context.SaveChangesAsync();
            await Service().DeleteOwnAccountAsync(user.Id, Password);
            Assert.False((await _context.Users.FirstAsync(u => u.Id == user.Id)).IsActive);
        }

        [Fact]
        public async Task Delete_WithPendingReturn_Throws()
        {
            var user = await AddUser();
            _context.Returns.Add(new Return { CustomerId = user.Id, ReturnNumber = "R-1", Status = ReturnStatus.PENDING, Reason = "defective" });
            await _context.SaveChangesAsync();
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().DeleteOwnAccountAsync(user.Id, Password));
        }

        [Fact]
        public async Task Delete_AlreadyDeleted_Throws()
        {
            var user = await AddUser();
            await Service().DeleteOwnAccountAsync(user.Id, Password);
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().DeleteOwnAccountAsync(user.Id, Password));
        }
    }
}
