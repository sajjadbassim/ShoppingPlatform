using System.Text.Json;
using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.FileService;
using ecommerce.Services.HomeService;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace ecommerce.Tests.Services
{
    // أقسام الصفحة الرئيسية: الفئة الرئيسية تشمل الفرعية، وسعر العرض مطبّق على البطاقات
    public class HomeSectionsTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly HomeSection _electronicsSection;
        private readonly HomeSection _customSection;
        private readonly Product _phone;

        public HomeSectionsTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

            var store = new Vendor { Name = "s", NameAr = "s", OwnerId = Guid.NewGuid(), IsActive = true };
            var electronics = new Category { Name = "Electronics", NameAr = "إلكترونيات" };
            var phones = new Category { Name = "Phones", NameAr = "هواتف", ParentId = electronics.Id };
            _phone = new Product { VendorId = store.Id, CategoryId = phones.Id, Name = "phone", NameAr = "هاتف", Price = 100000, StockQuantity = 5 };

            _electronicsSection = new HomeSection { Type = "featured_products", Title = "Electronics", FilterCategoryId = electronics.Id, MaxItems = 10 };
            _customSection = new HomeSection { Type = "custom_products", Title = "picks", MaxItems = 10 };

            _context.AddRange(store, electronics, phones, _phone, _electronicsSection, _customSection,
                new HomeSectionItem { SectionId = _customSection.Id, EntityId = _phone.Id },
                new Promotion
                {
                    Name = "sale", TargetType = PromotionTargetType.VENDOR, TargetId = store.Id,
                    DiscountType = DiscountType.PERCENTAGE, DiscountValue = 10, IsActive = true
                });
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private HomeService Service() => new(_context, new Mock<IFileService>().Object);

        private static List<JsonElement> Products(object? data) =>
            JsonSerializer.Deserialize<List<JsonElement>>(JsonSerializer.Serialize(data))!;

        [Fact]
        public async Task FeaturedSection_RootCategory_IncludesSubcategoryProducts()
        {
            var section = await Service().GetSectionByIdAsync(_electronicsSection.Id);

            Assert.Equal(_phone.Id, Assert.Single(Products(section.Data)).GetProperty("Id").GetGuid());
        }

        [Fact]
        public async Task BannerBlocks_AreSeparateFromHeroSlider()
        {
            var block = new HomeSection { Type = "banners", Title = "block", DisplayOrder = 9 };
            _context.AddRange(block,
                new Banner { Title = "hero", ImageUrl = "/h.png" },
                new Banner { Title = "b2", ImageUrl = "/2.png", SectionId = block.Id, DisplayOrder = 2 },
                new Banner { Title = "b1", ImageUrl = "/1.png", SectionId = block.Id, DisplayOrder = 1 },
                new Banner { Title = "expired", ImageUrl = "/x.png", SectionId = block.Id, EndsAt = DateTime.UtcNow.AddDays(-1) });
            await _context.SaveChangesAsync();

            var home = await Service().GetHomePageAsync();

            Assert.Equal("hero", Assert.Single(home.Banners).Title);
            var blockBanners = (List<ecommerce.Core.DTO.HomePage.BannerDto>)home.Sections.Single(s => s.Id == block.Id).Data!;
            Assert.Equal(new[] { "b1", "b2" }, blockBanners.Select(b => b.Title));
            Assert.Single(await Service().GetBannersAsync(onlyActive: false, heroOnly: true));
        }

        [Fact]
        public async Task Banner_CanOnlyTargetBannerSections()
        {
            var file = new Mock<Microsoft.AspNetCore.Http.IFormFile>().Object;
            var ex = await Assert.ThrowsAsync<Exception>(() => Service().CreateBannerAsync(
                new ecommerce.Core.DTO.HomePage.CreateBannerDto { Title = "x", ImageFile = file, SectionId = _customSection.Id }));

            Assert.Contains("ليس قسم بانرات", ex.Message);
        }

        [Fact]
        public async Task SectionHeaderBanner_SetForProductSections_RejectedForBlocks()
        {
            var files = new Mock<IFileService>();
            files.Setup(f => f.SaveImageAsync(It.IsAny<Microsoft.AspNetCore.Http.IFormFile>(), "banners")).ReturnsAsync("/uploads/banners/h.png");
            var service = new HomeService(_context, files.Object);
            var image = new Mock<Microsoft.AspNetCore.Http.IFormFile>().Object;

            var updated = await service.SetSectionBannerAsync(_customSection.Id, image);
            Assert.Equal("/uploads/banners/h.png", updated.BannerImageUrl);

            var block = new HomeSection { Type = "banners", Title = "block" };
            _context.Add(block);
            await _context.SaveChangesAsync();
            await Assert.ThrowsAsync<Exception>(() => service.SetSectionBannerAsync(block.Id, image));
        }

        [Fact]
        public async Task SectionCards_ShowPromotionPrice()
        {
            var card = Assert.Single(Products((await Service().GetSectionByIdAsync(_customSection.Id)).Data));

            Assert.Equal(90000m, card.GetProperty("Price").GetDecimal());
            Assert.Equal(100000m, card.GetProperty("OriginalPrice").GetDecimal());
            Assert.True(card.GetProperty("HasPromotion").GetBoolean());
        }
    }
}
