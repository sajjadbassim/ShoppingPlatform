using ecommerce.Core.DTO.HomePage;

namespace ecommerce.Services.HomeService
{
    public interface IHomeService
    {
        // ===================================
        // الصفحة الرئيسية
        // ===================================
        Task<HomePageDto> GetHomePageAsync();

        // ===================================
        // Banners
        // ===================================
        Task<List<BannerDto>> GetBannersAsync(bool onlyActive = true, bool heroOnly = false);
        Task<BannerDto> GetBannerByIdAsync(Guid id);
        Task<BannerDto> CreateBannerAsync(CreateBannerDto dto);
        Task<BannerDto> UpdateBannerAsync(Guid id, UpdateBannerDto dto);
        Task<bool> DeleteBannerAsync(Guid id);

        // ===================================
        // Sections
        // ===================================
        Task<List<HomeSectionDto>> GetSectionsAsync(bool onlyActive = true);
        Task<HomeSectionDto> GetSectionByIdAsync(Guid id);
        Task<HomeSectionDto> CreateSectionAsync(CreateHomeSectionDto dto);
        Task<HomeSectionDto> UpdateSectionAsync(Guid id, UpdateHomeSectionDto dto);
        Task<bool> DeleteSectionAsync(Guid id);
        Task<HomeSectionDto> SetSectionBannerAsync(Guid id, IFormFile image);
        Task<bool> RemoveSectionBannerAsync(Guid id);

        // ===================================
        // Section Items (للـ custom_products)
        // ===================================
        Task<HomeSectionDto> AddSectionItemAsync(Guid sectionId, AddSectionItemDto dto);
        Task<bool> RemoveSectionItemAsync(Guid sectionId, Guid productId);

    }
}
