using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    [Table("products")]
    public class Product
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("vendor_id")]
        public Guid VendorId { get; set; }

        [Column("category_id")]
        public Guid? CategoryId { get; set; }

        [Required]
        [MaxLength(255)]
        [Column("name")]
        public string Name { get; set; }

        [MaxLength(255)]
        [Column("name_ar")]
        public string NameAr { get; set; }

        [Column("description")]
        public string Description { get; set; }

        [Required]
        [Column("price", TypeName = "decimal(10,2)")]
        public decimal Price { get; set; }

        [Column("original_price", TypeName = "decimal(10,2)")]
        public decimal? OriginalPrice { get; set; }

        [MaxLength(100)]
        [Column("sku")]
        public string Sku { get; set; }

        [Column("stock_quantity")]
        public int StockQuantity { get; set; } = 0;

        [Column("is_available")]
        public bool IsAvailable { get; set; } = true;

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        [ForeignKey("VendorId")]
        public virtual Vendor Vendor { get; set; }

        [ForeignKey("CategoryId")]
        public virtual Category Category { get; set; }
        public virtual ICollection<SubOrderItem> SubOrderItems { get; set; }

        public ICollection<ProductImage> Images { get; set; } = new List<ProductImage>();

        public virtual ICollection<Wishlist> Wishlists { get; set; }

        public virtual ICollection<Review> Reviews { get; set; } = new List<Review>();

    }
}
