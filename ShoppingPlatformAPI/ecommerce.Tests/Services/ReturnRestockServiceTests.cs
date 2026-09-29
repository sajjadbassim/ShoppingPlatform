using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Inventory;
using ecommerce.Core.DTO.Return;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Interfaces;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services;
using ecommerce.Services.InventoryService;
using Moq;

namespace ecommerce.Tests.Services
{
    public class ReturnRestockServiceTests
    {
        private readonly Mock<IReturnRepository> _returnRepository = new();
        private readonly Mock<IInventoryService> _inventoryService = new();
        private readonly Mock<IReturnService> _returnService = new();
        private readonly Mock<IUnitOfWork> _unitOfWork = new();
        private readonly ReturnRestockService _service;

        private readonly Guid _returnId = Guid.NewGuid();
        private readonly Guid _adminId = Guid.NewGuid();
        private readonly Guid _productId = Guid.NewGuid();
        private readonly Guid _variantId = Guid.NewGuid();

        public ReturnRestockServiceTests()
        {
            // المعاملة تنفّذ العملية الممرَّرة كما هي
            _unitOfWork.Setup(u => u.ExecuteInTransactionAsync(It.IsAny<Func<Task>>(), It.IsAny<CancellationToken>()))
                .Returns<Func<Task>, CancellationToken>((operation, _) => operation());

            _returnService.Setup(s => s.GetByIdAsync(_returnId))
                .ReturnsAsync(new ReturnResponseDto { Id = _returnId, IsRestocked = true });

            _service = new ReturnRestockService(
                _returnRepository.Object, _inventoryService.Object, _returnService.Object, _unitOfWork.Object);
        }

        private void SetupReturn(string status, bool isRestocked = false)
        {
            _returnRepository.Setup(r => r.GetByIdWithItemsAsync(_returnId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Return
                {
                    Id = _returnId,
                    Status = status,
                    IsRestocked = isRestocked,
                    Items = new List<ReturnItem>
                    {
                        new() { ProductId = _productId, VariantId = _variantId, Quantity = 1 },
                        new() { ProductId = _productId, VariantId = _variantId, Quantity = 2 },
                        new() { ProductId = _productId, VariantId = null, Quantity = 4 }
                    }
                });
        }

        [Fact]
        public async Task RestockAsync_WhenReturnNotFound_ThrowsNotFoundException()
        {
            _returnRepository.Setup(r => r.GetByIdWithItemsAsync(_returnId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Return?)null);

            await Assert.ThrowsAsync<NotFoundException>(() => _service.RestockAsync(_returnId, _adminId));
        }

        [Theory]
        [InlineData(ReturnStatus.PENDING)]
        [InlineData(ReturnStatus.REJECTED)]
        public async Task RestockAsync_WhenReturnNotApproved_ThrowsBusinessRuleException(string status)
        {
            SetupReturn(status);

            await Assert.ThrowsAsync<BusinessRuleException>(() => _service.RestockAsync(_returnId, _adminId));
            _inventoryService.Verify(i => i.RestockAsync(It.IsAny<IEnumerable<StockLineQuantity>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task RestockAsync_WhenAlreadyRestocked_ThrowsConflictException()
        {
            SetupReturn(ReturnStatus.APPROVED, isRestocked: true);

            await Assert.ThrowsAsync<ConflictException>(() => _service.RestockAsync(_returnId, _adminId));
            _inventoryService.Verify(i => i.RestockAsync(It.IsAny<IEnumerable<StockLineQuantity>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task RestockAsync_WhenConcurrentRequestMarkedFirst_ThrowsConflictException()
        {
            SetupReturn(ReturnStatus.APPROVED);
            _returnRepository.Setup(r => r.TryMarkRestockedAsync(_returnId, _adminId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            await Assert.ThrowsAsync<ConflictException>(() => _service.RestockAsync(_returnId, _adminId));
            _inventoryService.Verify(i => i.RestockAsync(It.IsAny<IEnumerable<StockLineQuantity>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task RestockAsync_WhenApproved_RestocksGroupedLinesPerVariant()
        {
            SetupReturn(ReturnStatus.APPROVED);
            _returnRepository.Setup(r => r.TryMarkRestockedAsync(_returnId, _adminId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            List<StockLineQuantity>? restocked = null;
            _inventoryService.Setup(i => i.RestockAsync(It.IsAny<IEnumerable<StockLineQuantity>>(), It.IsAny<CancellationToken>()))
                .Callback<IEnumerable<StockLineQuantity>, CancellationToken>((lines, _) => restocked = lines.ToList())
                .ReturnsAsync(new List<StockChange>());

            var result = await _service.RestockAsync(_returnId, _adminId);

            Assert.True(result.IsRestocked);
            Assert.NotNull(restocked);
            Assert.Equal(2, restocked!.Count);
            Assert.Contains(new StockLineQuantity(_productId, _variantId, 3), restocked);
            Assert.Contains(new StockLineQuantity(_productId, null, 4), restocked);
        }
    }
}
