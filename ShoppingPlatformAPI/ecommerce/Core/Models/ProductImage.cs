using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{

    [Table("product_images")]
    public class ProductImage
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("product_id")]
        public Guid ProductId { get; set; }

        [Required]
        [MaxLength(500)]
        [Column("image_url")]
        public string ImageUrl { get; set; }

        [Column("is_primary")]
        public bool IsPrimary { get; set; } = false;

        [Column("display_order")]
        public int DisplayOrder { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Property
        [ForeignKey("ProductId")]
        public virtual Product Product { get; set; }
    }
}

