using System.Security.Claims;
using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Data.Interceptors;
using ecommerce.Services.ActivityLogService;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ecommerce.Tests.Services
{
    // سجل النشاط: ما تغيّر (قبل ← بعد) بلا الأسرار، ونطاق كل دور عند القراءة
    public class ActivityLogTests : IDisposable
    {
        private readonly HttpContextAccessor _http = new();
        private readonly DbContextOptions<AppDbContext> _options;
        private readonly AppDbContext _context;

        private readonly User _admin = new() { Phone = "1", FullName = "مدير", Role = UserRoles.Admin };
        private readonly User _ops = new() { Phone = "2", FullName = "موظف عمليات", Role = UserRoles.Ops };
        private readonly User _owner = new() { Phone = "3", FullName = "صاحب متجر", Role = UserRoles.Vendor };
        private readonly User _otherOwner = new() { Phone = "4", FullName = "متجر آخر", Role = UserRoles.Vendor };
        private readonly User _driverUser = new() { Phone = "5", FullName = "سائق", Role = UserRoles.Driver };
        private readonly User _customer = new() { Phone = "6", FullName = "زبون", Role = UserRoles.Customer };
        private readonly Vendor _v1;
        private readonly Vendor _v2;

        public ActivityLogTests()
        {
            _options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false))
                .AddInterceptors(new ActivityChangeInterceptor(_http)).Options;
            _context = new AppDbContext(_options);
            _v1 = new Vendor { Name = "A", NameAr = "متجر أ", OwnerId = _owner.Id };
            _v2 = new Vendor { Name = "B", NameAr = "متجر ب", OwnerId = _otherOwner.Id };
            _context.AddRange(_admin, _ops, _owner, _otherOwner, _driverUser, _customer, _v1, _v2);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private ActivityLogService Service() => new(_options, _context, _http);

        private DefaultHttpContext Request(User user, string method = "PUT")
        {
            var http = new DefaultHttpContext();
            http.Request.Method = method;
            http.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Role, user.Role),
            }, "test"));
            _http.HttpContext = http;
            return http;
        }

        // إجراء كامل: طلب HTTP يعدّل منتجاً ثم يُكتب سطره
        private async Task ChangeProductPrice(User actor, Vendor vendor, decimal price)
        {
            var http = Request(actor);
            var product = new Product { VendorId = vendor.Id, Name = "قميص", Price = 10_000 };
            _context.Products.Add(product);
            await _context.SaveChangesAsync();
            http.Items.Clear();

            product.Price = price;
            await _context.SaveChangesAsync();
            await Service().RecordActionAsync(http, "Products", "Update");
        }

        [Fact]
        public async Task Action_RecordsBeforeAfter_AndHidesSecrets()
        {
            var http = Request(_admin);
            var target = await _context.Users.SingleAsync(u => u.Id == _ops.Id);
            target.FullName = "اسم جديد";
            target.PasswordHash = "x";
            await _context.SaveChangesAsync();
            await Service().RecordActionAsync(http, "Users", "Update");

            var log = await _context.ActivityLogs.AsNoTracking().SingleAsync();
            Assert.Equal((UserRoles.Admin, "مدير", "Users.Update"), (log.ActorRole, log.ActorName, log.Action));
            Assert.StartsWith("تعديل بيانات مستخدم — اسم جديد", log.Summary);
            Assert.Contains("موظف عمليات", log.Details);   // القيمة القديمة
            Assert.DoesNotContain("PasswordHash", log.Details);
        }

        [Fact]
        public async Task Customer_And_Get_AreNotRecorded()
        {
            await Service().RecordActionAsync(Request(_customer), "Orders", "CreateOrder");
            Assert.Empty(_context.ActivityLogs);

            var http = Request(_admin, "GET");
            (await _context.Users.SingleAsync(u => u.Id == _ops.Id)).FullName = "x";
            await _context.SaveChangesAsync();
            Assert.Null(http.Items[ActivityChangeInterceptor.ItemsKey]);
        }

        [Fact]
        public async Task Scopes_AdminAll_OpsTeam_VendorOwnAndAffecting_DriverOwn()
        {
            await ChangeProductPrice(_owner, _v1, 9_000);        // المتجر نفسه
            await ChangeProductPrice(_ops, _v1, 8_000);          // العمليات على منتج المتجر
            await ChangeProductPrice(_otherOwner, _v2, 7_000);   // متجر آخر
            await Service().RecordActionAsync(Request(_driverUser, "POST"), "DriverApp", "SetWorkStatus");

            var q = new ActivityLogQuery();
            Assert.Equal(4, (await Service().QueryAsync(q, _admin.Id, UserRoles.Admin)).Total);
            Assert.Equal(1, (await Service().QueryAsync(q, _ops.Id, UserRoles.Ops)).Total);
            Assert.Equal(1, (await Service().QueryAsync(q, _driverUser.Id, UserRoles.Driver)).Total);

            var (mine, total) = await Service().QueryAsync(q, _owner.Id, UserRoles.Vendor);
            Assert.Equal(2, total);
            // ما فعلته العمليات: باسم الدور، بلا تفاصيل داخلية ولا عنوان IP
            var byOps = mine.Single(l => l.ActorRole == UserRoles.Ops);
            Assert.Equal(("فريق العمليات", (Guid?)null), (byOps.ActorName, byOps.ActorUserId));
            Assert.Null(byOps.Details);
            Assert.NotNull(mine.Single(l => l.ActorRole == UserRoles.Vendor).Details);

            Assert.Equal(1, (await Service().QueryAsync(new ActivityLogQuery { VendorId = _v2.Id }, _admin.Id, UserRoles.Admin)).Total);
        }

        [Fact]
        public async Task Purge_DeletesOnlyOlderThanCutoff_NewestFirst()
        {
            _context.ActivityLogs.AddRange(
                new ActivityLog { ActorRole = UserRoles.Ops, Action = "a", Summary = "قديم جداً", At = DateTime.UtcNow.AddDays(-61) },
                new ActivityLog { ActorRole = UserRoles.Ops, Action = "a", Summary = "قبل 40 يوماً", At = DateTime.UtcNow.AddDays(-40) },
                new ActivityLog { ActorRole = UserRoles.Ops, Action = "a", Summary = "أمس", At = DateTime.UtcNow.AddDays(-1) },
                new ActivityLog { ActorRole = UserRoles.Ops, Action = "a", Summary = "الآن", At = DateTime.UtcNow });
            await _context.SaveChangesAsync();

            var (items, _) = await Service().QueryAsync(new ActivityLogQuery(), _admin.Id, UserRoles.Admin);
            Assert.Equal("الآن", items.First().Summary);   // الأحدث أولاً

            Assert.Equal(1, await Service().PurgeOlderThanAsync(ActivityLogRetentionService.RetentionDays));   // التلقائي: أقدم من 60
            Assert.Equal(1, await Service().PurgeOlderThanAsync(30));                                            // الزر: أقدم من 30
            Assert.Equal(new[] { "الآن", "أمس" }, (await Service().QueryAsync(new ActivityLogQuery(), _admin.Id, UserRoles.Admin)).Items.Select(i => i.Summary));
        }

        [Fact]
        public async Task Logins_SkipCustomers_FilterFailed()
        {
            Request(_ops, "POST");
            await Service().RecordLoginAsync(_ops, success: true);
            await Service().RecordLoginAsync(_ops, success: false);
            await Service().RecordLoginAsync(_customer, success: true);

            var (items, total) = await Service().QueryAsync(new ActivityLogQuery { Kind = ActivityKind.Auth }, _admin.Id, UserRoles.Admin);
            Assert.Equal(2, total);
            Assert.Single((await Service().QueryAsync(new ActivityLogQuery { FailedLoginsOnly = true }, _admin.Id, UserRoles.Admin)).Items);
            Assert.All(items, l => Assert.Equal("موظف عمليات", l.ActorName));
        }
    }
}
