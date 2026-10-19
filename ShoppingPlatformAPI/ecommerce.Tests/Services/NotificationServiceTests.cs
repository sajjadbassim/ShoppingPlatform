using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Hubs;
using ecommerce.Repositories;
using ecommerce.Services.NotificationService;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace ecommerce.Tests.Services
{
    // اختبارات فلترة الإشعارات حسب تفضيلات المستخدم
    public class NotificationServiceTests
    {
        private readonly Mock<INotificationRepository> _notificationRepository = new();
        private readonly Mock<IUserRepository> _userRepository = new();
        private readonly Mock<IVendorRepository> _vendorRepository = new();
        private readonly Mock<IProductRepository> _productRepository = new();
        private readonly Mock<IUserPreferencesRepository> _preferencesRepository = new();
        private readonly NotificationService _service;

        public NotificationServiceTests()
        {
            var clientProxy = new Mock<IClientProxy>();
            var hubClients = new Mock<IHubClients>();
            hubClients.Setup(c => c.User(It.IsAny<string>())).Returns(clientProxy.Object);
            hubClients.Setup(c => c.Group(It.IsAny<string>())).Returns(clientProxy.Object);

            var notificationHub = new Mock<IHubContext<NotificationHub>>();
            notificationHub.Setup(h => h.Clients).Returns(hubClients.Object);
            var opsHub = new Mock<IHubContext<OpsHub>>();
            opsHub.Setup(h => h.Clients).Returns(hubClients.Object);

            _notificationRepository.Setup(r => r.CreateAsync(It.IsAny<Notification>()))
                .ReturnsAsync((Notification n) => n);

            _service = new NotificationService(
                notificationHub.Object, opsHub.Object,
                _notificationRepository.Object, _userRepository.Object, _vendorRepository.Object,
                _productRepository.Object, _preferencesRepository.Object,
                NullLogger<NotificationService>.Instance);
        }

        [Fact]
        public async Task NotifyAdminsAsync_SkipsAdminsWhoDisabledCategory()
        {
            var enabledAdmin = new User { Id = Guid.NewGuid() };
            var disabledAdmin = new User { Id = Guid.NewGuid() };
            var adminWithoutPreferences = new User { Id = Guid.NewGuid() };

            _userRepository.Setup(r => r.GetByRoleAsync(UserRoles.Admin))
                .ReturnsAsync(new[] { enabledAdmin, disabledAdmin, adminWithoutPreferences });
            _preferencesRepository.Setup(r => r.GetByUserIdsAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<UserPreferences>
                {
                    new() { UserId = enabledAdmin.Id, NotifyReturns = true },
                    new() { UserId = disabledAdmin.Id, NotifyReturns = false }
                });

            await _service.NotifyAdminsAsync(NotificationCategory.Returns, NotificationType.RETURN, "طلب إرجاع جديد");

            _notificationRepository.Verify(r => r.CreateAsync(It.Is<Notification>(n => n.UserId == enabledAdmin.Id)), Times.Once);
            _notificationRepository.Verify(r => r.CreateAsync(It.Is<Notification>(n => n.UserId == adminWithoutPreferences.Id)), Times.Once);
            _notificationRepository.Verify(r => r.CreateAsync(It.Is<Notification>(n => n.UserId == disabledAdmin.Id)), Times.Never);
        }

        [Fact]
        public async Task NotifyAdminsAsync_ForNewUsers_IsOffByDefault()
        {
            var admin = new User { Id = Guid.NewGuid() };
            _userRepository.Setup(r => r.GetByRoleAsync(UserRoles.Admin)).ReturnsAsync(new[] { admin });
            _preferencesRepository.Setup(r => r.GetByUserIdsAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<UserPreferences>());

            await _service.NotifyAdminsAsync(NotificationCategory.NewUsers, NotificationType.NEW_USER, "مستخدم جديد");

            _notificationRepository.Verify(r => r.CreateAsync(It.IsAny<Notification>()), Times.Never);
        }

        [Fact]
        public async Task NotifyVendorAsync_WhenVendorHasNoOwner_SendsNothing()
        {
            var vendorId = Guid.NewGuid();
            _vendorRepository.Setup(r => r.GetByIdAsync(vendorId)).ReturnsAsync(new Vendor { Id = vendorId, OwnerId = null });

            await _service.NotifyVendorAsync(vendorId, NotificationCategory.NewOrders, NotificationType.NEW_ORDER, "طلب جديد");

            _notificationRepository.Verify(r => r.CreateAsync(It.IsAny<Notification>()), Times.Never);
        }

        // متعدد المتاجر: متجر بدأ التحضير قبل تأكيد الآخر ← يقفز الطلب من «مؤكد جزئياً» إلى «قيد التحضير»
        // دون «مؤكد» — كان الزبون لا يصله «تم تأكيد طلبك» أبداً
        [Fact]
        public async Task CustomerStatus_SkippedConfirmed_IsMergedIntoPreparingNotice()
        {
            using var context = new ecommerce.Data.AppDbContext(new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<ecommerce.Data.AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
            var orderId = Guid.NewGuid();
            context.OrderStatusLogs.AddRange(
                new OrderStatusLog { OrderId = orderId, OldStatus = OrderStatus.PENDING_CONFIRMATION, NewStatus = OrderStatus.PARTIALLY_CONFIRMED },
                new OrderStatusLog { OrderId = orderId, OldStatus = OrderStatus.PARTIALLY_CONFIRMED, NewStatus = OrderStatus.PREPARING });
            context.SaveChanges();
            var service = Service(context);

            await service.NotifyCustomerOrderStatusAsync(Guid.NewGuid(), orderId, "ORD-1", OrderStatus.PREPARING);

            _notificationRepository.Verify(r => r.CreateAsync(It.Is<Notification>(n =>
                n.Message.Contains("تم تأكيد طلبك") && n.Message.Contains("قيد التحضير"))), Times.Once);
        }

        [Fact]
        public async Task CustomerStatus_AfterConfirmed_PreparingNoticeIsPlain()
        {
            using var context = new ecommerce.Data.AppDbContext(new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<ecommerce.Data.AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
            var orderId = Guid.NewGuid();
            context.OrderStatusLogs.AddRange(
                new OrderStatusLog { OrderId = orderId, OldStatus = OrderStatus.PENDING_CONFIRMATION, NewStatus = OrderStatus.CONFIRMED },
                new OrderStatusLog { OrderId = orderId, OldStatus = OrderStatus.CONFIRMED, NewStatus = OrderStatus.PREPARING });
            context.SaveChanges();

            await Service(context).NotifyCustomerOrderStatusAsync(Guid.NewGuid(), orderId, "ORD-1", OrderStatus.PREPARING);

            _notificationRepository.Verify(r => r.CreateAsync(It.Is<Notification>(n => !n.Message.Contains("تم تأكيد"))), Times.Once);
        }

        private NotificationService Service(ecommerce.Data.AppDbContext context)
        {
            var hubClients = new Mock<IHubClients>();
            hubClients.Setup(c => c.User(It.IsAny<string>())).Returns(new Mock<IClientProxy>().Object);
            var notificationHub = new Mock<IHubContext<NotificationHub>>();
            notificationHub.Setup(h => h.Clients).Returns(hubClients.Object);
            return new NotificationService(notificationHub.Object, new Mock<IHubContext<OpsHub>>().Object,
                _notificationRepository.Object, _userRepository.Object, _vendorRepository.Object,
                _productRepository.Object, _preferencesRepository.Object, NullLogger<NotificationService>.Instance, context: context);
        }

        [Fact]
        public async Task NotifyVendorAsync_WhenRepositoryFails_DoesNotThrow()
        {
            var vendorId = Guid.NewGuid();
            _vendorRepository.Setup(r => r.GetByIdAsync(vendorId)).ThrowsAsync(new InvalidOperationException("db down"));

            var exception = await Record.ExceptionAsync(() =>
                _service.NotifyVendorAsync(vendorId, NotificationCategory.NewOrders, NotificationType.NEW_ORDER, "طلب جديد"));

            Assert.Null(exception);
        }
    }
}
