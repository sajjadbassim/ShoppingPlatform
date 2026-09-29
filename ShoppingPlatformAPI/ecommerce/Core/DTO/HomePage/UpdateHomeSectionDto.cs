using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.HomePage
{
    public class UpdateHomeSectionDto
    {
        [MaxLength(255)]
        public string? Title { get; set; }

        [MaxLength(255)]
        public string? TitleAr { get; set; }

        [MaxLength(500)]
        public string? Subtitle { get; set; }

        [MaxLength(500)]
        public string? SubtitleAr { get; set; }

        public int? MaxItems { get; set; }
        public bool? IsActive { get; set; }
        public int? DisplayOrder { get; set; }
        public Guid? FilterCategoryId { get; set; }
        public Guid? FilterVendorId { get; set; }
    }
}
