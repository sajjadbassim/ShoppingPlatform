using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace ecommerce.Core.DTO.HomePage
{
    public class UpdateBannerDto
    {
        [MaxLength(255)]
        public string? Title { get; set; }

        [MaxLength(255)]
        public string? TitleAr { get; set; }

        [MaxLength(500)]
        public string? Subtitle { get; set; }

        [MaxLength(500)]
        public string? SubtitleAr { get; set; }

        public IFormFile? ImageFile { get; set; }  // ✅ اختياري عند التعديل

        public string? LinkUrl { get; set; }
        public string? LinkType { get; set; }
        public Guid? LinkEntityId { get; set; }
        public bool? IsActive { get; set; }
        public int? DisplayOrder { get; set; }
        public DateTime? StartsAt { get; set; }
        public DateTime? EndsAt { get; set; }
    }
}