using ecommerce.Core.DTO.Inventory;
using ecommerce.Core.Exceptions;
using ecommerce.Repositories;
using ecommerce.Services.InventoryService;
using ecommerce.Services.NotificationService;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace ecommerce.Tests.Services
{
    public class InventoryServiceTests
    {
        private readonly Mock<IInventoryRepository> _repository = new();
        private readonly Mock<INotificationService> _notifications = new();
        private readonly InventoryService _service;

        private readonly Guid _productId = Guid.NewGuid();
        private readonly Guid _variantId = Guid.NewGuid();
        private readonly Guid _vendorId = Guid.NewGuid();

        public InventoryServiceTests()
        {
            _service = new InventoryService(_repository.Object, _notifications.Object, NullLogger<InventoryService>.Instance);
        }

        [Fact]
        public async Task ReserveAsync_WhenStockInsufficient_ThrowsConflictException()
        {
            _repository.Setup(r => r.TryDecreaseProductStockAsync(_productId, 5, It.IsAny<CancellationToken>()))
                .ReturnsAsync((int?)null);

            await Assert.ThrowsAsync<ConflictException>(() =>
                _service.ReserveAsync(new[] { new StockLine(_productId, null, 5, "قميص") }));
        }

        [Fact]
        public async Task ReserveAsync_WithVariant_DecreasesVariantStockNotProductStock()
        {
            _repository.Setup(r => r.TryDecreaseVariantStockAsync(_variantId, 2, It.IsAny<CancellationToken>()))
                .ReturnsAsync(8);

            var changes = await _service.ReserveAsync(new[] { new StockLine(_productId, _variantId, 2, "قميص") });

            Assert.Equal(new StockChange(_productId, _variantId, 10, 8), Assert.Single(changes));
            _repository.Verify(r => r.TryDecreaseProductStockAsync(It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task ReserveAsync_WithDuplicateLines_DecreasesMergedQuantityOnce()
        {
            _repository.Setup(r => r.TryDecreaseProductStockAsync(_productId, 5, It.IsAny<CancellationToken>()))
                .ReturnsAsync(0);

            await _service.ReserveAsync(new[]
            {
                new StockLine(_productId, null, 2, "قميص"),
                new StockLine(_productId, null, 3, "قميص")
            });

            _repository.Verify(r => r.TryDecreaseProductStockAsync(_productId, 5, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task RestockAsync_WhenItemNoLongerExists_SkipsIt()
        {
            _repository.Setup(r => r.IncreaseVariantStockAsync(_variantId, 1, It.IsAny<CancellationToken>()))
                .ReturnsAsync((int?)null);

            var changes = await _service.RestockAsync(new[] { new StockLineQuantity(_productId, _variantId, 1) });

            Assert.Empty(changes);
        }

        [Fact]
        public async Task NotifyLowStockAsync_WhenCrossingThreshold_NotifiesWithVariantSku()
        {
            _repository.Setup(r => r.GetStockItemInfoAsync(_productId, _variantId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new StockItemInfo(_vendorId, "قميص", "RED-M"));

            await _service.NotifyLowStockAsync(new[] { new StockChange(_productId, _variantId, 10, 9) });

            _notifications.Verify(n => n.NotifyLowStockAsync(_productId, "قميص (RED-M)", _vendorId, 9), Times.Once);
        }

        [Fact]
        public async Task NotifyLowStockAsync_WhenAlreadyLow_DoesNotNotifyAgain()
        {
            await _service.NotifyLowStockAsync(new[] { new StockChange(_productId, null, 5, 4) });

            _notifications.Verify(n => n.NotifyLowStockAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<int>()), Times.Never);
        }

        [Fact]
        public async Task NotifyLowStockAsync_WhenRunsOut_Notifies()
        {
            _repository.Setup(r => r.GetStockItemInfoAsync(_productId, null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new StockItemInfo(_vendorId, "قميص", null));

            await _service.NotifyLowStockAsync(new[] { new StockChange(_productId, null, 3, 0) });

            _notifications.Verify(n => n.NotifyLowStockAsync(_productId, "قميص", _vendorId, 0), Times.Once);
        }
    }
}
