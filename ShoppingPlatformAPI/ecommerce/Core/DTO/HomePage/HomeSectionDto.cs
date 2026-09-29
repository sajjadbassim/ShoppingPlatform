namespace ecommerce.Core.DTO.HomePage
{
    public class HomeSectionDto
    {
        public Guid Id { get; set; }
        public string Type { get; set; }
        public string Title { get; set; }
        public string? TitleAr { get; set; }
        public string? Subtitle { get; set; }
        public string? SubtitleAr { get; set; }
        public int MaxItems { get; set; }
        public int DisplayOrder { get; set; }
        public Guid? FilterCategoryId { get; set; }
        public Guid? FilterVendorId { get; set; }
        public bool IsActive { get; set; }
        public object? Data { get; set; } // المنتجات / البائعين / التصنيفات المحملة
    }
}
