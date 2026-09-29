using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Category
{
    public class CategoryCreateDto
    {
        [Required]
        [MaxLength(255)]
        public string Name { get; set; }

        [MaxLength(255)]
        public string NameAr { get; set; }

        public string Description { get; set; }

        public IFormFile? Icon { get; set; }

        public Guid? ParentId { get; set; }

        public int DisplayOrder { get; set; } = 0;

        public bool IsActive { get; set; } = true;
    }
}
