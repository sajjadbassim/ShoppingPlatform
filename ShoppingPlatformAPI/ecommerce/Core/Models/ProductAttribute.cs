using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    // ===================================
    // ProductAttribute — نوع الخاصية
    // مثال: الحجم، اللون، الوزن
    // ===================================
    [Table("product_attributes")]
    public class ProductAttribute
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("product_id")]
        public Guid ProductId { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("name")]
        public string Name { get; set; }           // مثال: Size

        [MaxLength(100)]
        [Column("name_ar")]
        public string? NameAr { get; set; }        // مثال: الحجم

        [Column("display_order")]
        public int DisplayOrder { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("ProductId")]
        public virtual Product Product { get; set; }

        public virtual ICollection<ProductAttributeValue> Values { get; set; } = new List<ProductAttributeValue>();
    }

    // ===================================
    // ProductAttributeValue — قيم الخاصية
    // مثال: S، M، L، XL
    // ===================================
    [Table("product_attribute_values")]
    public class ProductAttributeValue
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("attribute_id")]
        public Guid AttributeId { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("value")]
        public string Value { get; set; }           // مثال: Large

        [MaxLength(100)]
        [Column("value_ar")]
        public string? ValueAr { get; set; }        // مثال: كبير

        [Column("display_order")]
        public int DisplayOrder { get; set; } = 0;

        // Navigation
        [ForeignKey("AttributeId")]
        public virtual ProductAttribute Attribute { get; set; }

        public virtual ICollection<ProductVariantAttributeValue> VariantValues { get; set; } = new List<ProductVariantAttributeValue>();
    }

    // ===================================
    // ProductVariant — المتغير الكامل
    // مثال: حجم L + لون أحمر
    // ===================================
    [Table("product_variants")]
    public class ProductVariant
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("product_id")]
        public Guid ProductId { get; set; }

        [MaxLength(100)]
        [Column("sku")]
        public string? Sku { get; set; }

        [Column("price_adjustment", TypeName = "decimal(10,2)")]
        public decimal PriceAdjustment { get; set; } = 0; // إضافة/خصم على سعر المنتج

        [Column("stock_quantity")]
        public int StockQuantity { get; set; } = 0;

        [Column("is_available")]
        public bool IsAvailable { get; set; } = true;

        [Column("image_url")]
        public string? ImageUrl { get; set; }

        [Column("display_order")]
        public int DisplayOrder { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("ProductId")]
        public virtual Product Product { get; set; }

        public virtual ICollection<ProductVariantAttributeValue> AttributeValues { get; set; } = new List<ProductVariantAttributeValue>();
    }

    // ===================================
    // ProductVariantAttributeValue — ربط المتغير بالقيم
    // مثال: Variant_1 → Size:L, Color:Red
    // ===================================
    [Table("product_variant_attribute_values")]
    public class ProductVariantAttributeValue
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("variant_id")]
        public Guid VariantId { get; set; }

        [Required]
        [Column("attribute_value_id")]
        public Guid AttributeValueId { get; set; }

        // Navigation
        [ForeignKey("VariantId")]
        public virtual ProductVariant Variant { get; set; }

        [ForeignKey("AttributeValueId")]
        public virtual ProductAttributeValue AttributeValue { get; set; }
    }
}