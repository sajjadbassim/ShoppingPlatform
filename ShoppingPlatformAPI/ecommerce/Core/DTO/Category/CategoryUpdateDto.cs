using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Category
{
    public class CategoryUpdateDto
    {
        [MaxLength(255)]
        public string? Name { get; set; }

        [MaxLength(255)]
        public string? NameAr { get; set; }

        public string? Description { get; set; }

        public IFormFile? NewIcon { get; set; }

        public Guid? ParentId { get; set; }

        public int? DisplayOrder { get; set; }

        public bool? IsActive { get; set; }
    }
}
