namespace ecommerce.Core.DTO.HomePage
{
    public class BannerDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; }
        public string? TitleAr { get; set; }
        public string? Subtitle { get; set; }
        public string? SubtitleAr { get; set; }
        public string ImageUrl { get; set; }
        public string? LinkUrl { get; set; }
        public string? LinkType { get; set; }
        public Guid? LinkEntityId { get; set; }
        public int DisplayOrder { get; set; }
        public DateTime? StartsAt { get; set; }
        public DateTime? EndsAt { get; set; }
        public bool IsActive { get; set; }
    }
}
