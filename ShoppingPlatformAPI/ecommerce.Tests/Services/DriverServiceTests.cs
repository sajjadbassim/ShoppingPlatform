using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services;
using Moq;

namespace ecommerce.Tests.Services
{
    // قائمة السائقين للعمليات
    public class DriverServiceTests
    {
        // كانت الصفحات تعيد activeOrders = 0 دائماً (الحمل يُحسب في «المتاحين» فقط)
        [Fact]
        public async Task Paged_FillsActiveOrdersPerDriver()
        {
            var busy = new Driver { Id = Guid.NewGuid(), FullName = "علي", Phone = "07700000001" };
            var idle = new Driver { Id = Guid.NewGuid(), FullName = "حسن", Phone = "07700000002" };
            var repo = new Mock<IDriverRepository>();
            repo.Setup(r => r.GetPagedAsync(1, 20, null, null)).ReturnsAsync((new[] { busy, idle }, 2));
            repo.Setup(r => r.GetActiveOrderCountsAsync(It.IsAny<IEnumerable<Guid>>()))
                .ReturnsAsync(new Dictionary<Guid, int> { [busy.Id] = 3 });

            var result = await new DriverService(repo.Object, new Mock<ISubOrderRepository>().Object, new Mock<IUserRepository>().Object)
                .GetDriversPagedAsync(1, 20, null, null);

            Assert.Equal(3, result.Items.Single(d => d.Id == busy.Id).ActiveOrders);
            Assert.Equal(0, result.Items.Single(d => d.Id == idle.Id).ActiveOrders);
        }
    }
}
