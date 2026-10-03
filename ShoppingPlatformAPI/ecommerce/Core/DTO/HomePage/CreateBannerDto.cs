using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace ecommerce.Core.DTO.HomePage
{
    public class CreateBannerDto
    {
        [Required]
        [MaxLength(255)]
        public string Title { get; set; }

        [MaxLength(255)]
        public string? TitleAr { get; set; }

        [MaxLength(500)]
        public string? Subtitle { get; set; }

        [MaxLength(500)]
        public string? SubtitleAr { get; set; }

        [Required(ErrorMessage = "الصورة مطلوبة")]
        public IFormFile ImageFile { get; set; }  // ✅ مطلوب دائماً

        public string? LinkUrl { get; set; }
        public string? LinkType { get; set; }
        public Guid? LinkEntityId { get; set; }
        public int DisplayOrder { get; set; } = 0;
        public DateTime? StartsAt { get; set; }
        public DateTime? EndsAt { get; set; }

        // null = السلايدر العلوي، وإلا = قسم "بلوك بانرات"
        public Guid? SectionId { get; set; }
    }
}