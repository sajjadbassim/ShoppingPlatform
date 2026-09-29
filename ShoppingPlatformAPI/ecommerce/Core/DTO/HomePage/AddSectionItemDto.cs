using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.HomePage
{
    public class AddSectionItemDto
    {
        [Required]
        public Guid ProductId { get; set; }
        public int DisplayOrder { get; set; } = 0;
    }
}
