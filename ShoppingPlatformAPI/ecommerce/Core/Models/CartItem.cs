using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    [Table("cart_items")]
    public class CartItem
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("cart_id")]
        public Guid CartId { get; set; }

        [Required]
        [Column("product_id")]
        public Guid ProductId { get; set; }
      
        [Column("variant_id")]
        public Guid? VariantId { get; set; }

        [Required]
        [Column("quantity")]
        public int Quantity { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        [ForeignKey("CartId")]
        public virtual Cart Cart { get; set; }

        [ForeignKey("ProductId")]
        public virtual Product Product { get; set; }


        [ForeignKey("VariantId")]
        public virtual ProductVariant? Variant { get; set; }
    }
}
