namespace ecommerce.Core.DTO.HomePage
{
    public class HomePageDto
    {
        public List<BannerDto> Banners { get; set; } = new();
        public List<HomeSectionDto> Sections { get; set; } = new();
    }
}
