using ecommerce.Core.DTO.Users;
using ecommerce.Core.Interfaces;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services.UserPreferencesService;
using Moq;

namespace ecommerce.Tests.Services
{
    public class UserPreferencesServiceTests
    {
        private readonly Mock<IUserPreferencesRepository> _repository = new();
        private readonly Mock<IUnitOfWork> _unitOfWork = new();
        private readonly UserPreferencesService _service;
        private readonly Guid _userId = Guid.NewGuid();

        public UserPreferencesServiceTests()
        {
            _service = new UserPreferencesService(_repository.Object, _unitOfWork.Object);
        }

        [Fact]
        public async Task GetAsync_WhenNoRecord_ReturnsDefaultsWithoutSaving()
        {
            _repository.Setup(r => r.GetByUserIdAsync(_userId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((UserPreferences?)null);

            var result = await _service.GetAsync(_userId);

            Assert.Equal("ar", result.Language);
            Assert.Equal("light", result.Theme);
            Assert.True(result.NotifyNewOrders);
            Assert.False(result.NotifyNewUsers);
            _repository.Verify(r => r.AddAsync(It.IsAny<UserPreferences>(), It.IsAny<CancellationToken>()), Times.Never);
            _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UpdateAsync_WhenNoRecord_AddsRecordAndSavesOnce()
        {
            _repository.Setup(r => r.GetByUserIdAsync(_userId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((UserPreferences?)null);

            var result = await _service.UpdateAsync(_userId, new UserPreferencesUpdateDto { NotifyNewOrders = false });

            Assert.False(result.NotifyNewOrders);
            _repository.Verify(r => r.AddAsync(
                It.Is<UserPreferences>(p => p.UserId == _userId && !p.NotifyNewOrders),
                It.IsAny<CancellationToken>()), Times.Once);
            _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UpdateAsync_WhenRecordExists_ChangesOnlyProvidedFields()
        {
            var existing = new UserPreferences { UserId = _userId, Theme = "dark", NotifyReviews = false };
            _repository.Setup(r => r.GetByUserIdAsync(_userId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(existing);

            var result = await _service.UpdateAsync(_userId, new UserPreferencesUpdateDto { Language = "en" });

            Assert.Equal("en", result.Language);
            Assert.Equal("dark", result.Theme);
            Assert.False(result.NotifyReviews);
            _repository.Verify(r => r.AddAsync(It.IsAny<UserPreferences>(), It.IsAny<CancellationToken>()), Times.Never);
            _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
