using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.HomePage
{
    public class CreateHomeSectionDto
    {
        [Required]
        public string Type { get; set; } // featured_products | top_vendors | top_categories | custom_products

        [Required]
        [MaxLength(255)]
        public string Title { get; set; }

        [MaxLength(255)]
        public string? TitleAr { get; set; }

        [MaxLength(500)]
        public string? Subtitle { get; set; }

        [MaxLength(500)]
        public string? SubtitleAr { get; set; }

        public int MaxItems { get; set; } = 10;
        public Guid? FilterCategoryId { get; set; }
        public Guid? FilterVendorId { get; set; }
        public int DisplayOrder { get; set; } = 0;

        // general (الرئيسية) | grocery (السوبرماركت)
        public string? Page { get; set; }

        // flash_deals: وقت انتهاء العرض (مطلوب) — يختفي القسم بعده
        public DateTime? EndsAt { get; set; }

        // للـ custom_products فقط
        public List<Guid>? ProductIds { get; set; }
    }

}
