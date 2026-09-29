using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    [Table("sub_order_items")]

    public class SubOrderItem
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("sub_order_id")]
        public Guid SubOrderId { get; set; }

        [Required]
        [Column("product_id")]
        public Guid ProductId { get; set; }

        [Required]
        [MaxLength(255)]
        [Column("product_name")]
        public string ProductName { get; set; }

        [MaxLength(255)]
        [Column("product_name_ar")]
        public string ProductNameAr { get; set; }

        [Column("product_image_url")]
        public string ProductImageUrl { get; set; }

        [Required]
        [Column("unit_price", TypeName = "decimal(10,2)")]
        public decimal UnitPrice { get; set; }

        [Required]
        [Column("quantity")]
        public int Quantity { get; set; }

        [Required]
        [Column("subtotal", TypeName = "decimal(10,2)")]
        public decimal Subtotal { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        [ForeignKey("SubOrderId")]
        public virtual SubOrder SubOrder { get; set; }

        [ForeignKey("ProductId")]
        public virtual Product Product { get; set; }

        [Column("variant_id")]
        public Guid? VariantId { get; set; }

        [ForeignKey("VariantId")]
        public virtual ProductVariant? Variant { get; set; }
    }
}
