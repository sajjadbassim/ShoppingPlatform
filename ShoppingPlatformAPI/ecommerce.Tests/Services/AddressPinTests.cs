using ecommerce.Core.DTO.Addresses;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services;
using Moq;
using Xunit;

namespace ecommerce.Tests.Services
{
    // دبوس العنوان على الخريطة: يُحفظ، لا يُمسح عند التعديل، ويُرفض إن كان ناقصاً أو غير صالح
    public class AddressPinTests
    {
        private readonly Mock<IAddressRepository> _repo = new();
        private readonly Address _saved = new() { Label = "البيت", City = "الكوت", Latitude = 32.5051m, Longitude = 45.8243m };

        public AddressPinTests()
        {
            _repo.Setup(r => r.GetByIdAsync(_saved.Id)).ReturnsAsync(_saved);
            _repo.Setup(r => r.UpdateAsync(It.IsAny<Address>())).ReturnsAsync((Address a) => a);
            _repo.Setup(r => r.CreateAsync(It.IsAny<Address>())).ReturnsAsync((Address a) => a);
        }

        private AddressService Service() => new(_repo.Object);

        [Fact]
        public async Task EditWithoutPin_KeepsSavedPin()
        {
            await Service().UpdateAsync(_saved.Id, new AddressUpdateDto { Label = "المنزل", StreetAddress = "شارع 1" });
            Assert.Equal(32.5051m, _saved.Latitude);
            Assert.Equal(45.8243m, _saved.Longitude);
        }

        [Fact]
        public async Task EditWithPin_MovesIt()
        {
            await Service().UpdateAsync(_saved.Id, new AddressUpdateDto { StreetAddress = "x", Latitude = 32.51m, Longitude = 45.83m });
            Assert.Equal(32.51m, _saved.Latitude);
        }

        [Theory]
        [InlineData(32.5, null)]      // ناقص
        [InlineData(95.0, 45.0)]      // خارج النطاق
        [InlineData(0.0, 0.0)]        // موقع افتراضي خاطئ من المتصفح
        public async Task InvalidPin_IsRejected(double? lat, double? lng)
        {
            var dto = new AddressCreateDto { StreetAddress = "x", City = "c", Area = "a", Phone = "0770",
                Latitude = (decimal?)lat, Longitude = (decimal?)lng };
            await Assert.ThrowsAsync<Exception>(() => Service().CreateAsync(dto));
            _repo.Verify(r => r.CreateAsync(It.IsAny<Address>()), Times.Never);
        }
    }
}
