using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    // ===================================
    // Banner — البانرات الإعلانية
    // ===================================
    [Table("banners")]
    public class Banner
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(255)]
        [Column("title")]
        public string Title { get; set; }

        [MaxLength(255)]
        [Column("title_ar")]
        public string? TitleAr { get; set; }

        [MaxLength(500)]
        [Column("subtitle")]
        public string? Subtitle { get; set; }

        [MaxLength(500)]
        [Column("subtitle_ar")]
        public string? SubtitleAr { get; set; }

        [Required]
        [Column("image_url")]
        public string ImageUrl { get; set; }

        [Column("link_url")]
        public string? LinkUrl { get; set; }       // رابط عند الضغط

        [MaxLength(50)]
        [Column("link_type")]
        public string? LinkType { get; set; }      // product | category | vendor | url

        [Column("link_entity_id")]
        public Guid? LinkEntityId { get; set; }    // ID المنتج/التصنيف/البائع

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("display_order")]
        public int DisplayOrder { get; set; } = 0;

        [Column("starts_at")]
        public DateTime? StartsAt { get; set; }

        [Column("ends_at")]
        public DateTime? EndsAt { get; set; }

        // مكان الظهور: null = السلايدر العلوي، وإلا = قسم "بلوك بانرات" في الصفحة الرئيسية
        [Column("section_id")]
        public Guid? SectionId { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    // ===================================
    // HomeSection — أقسام الصفحة الرئيسية
    // مثال: "منتجات مميزة"، "الأكثر مبيعاً"
    // ===================================
    [Table("home_sections")]
    public class HomeSection
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(100)]
        [Column("type")]
        public string Type { get; set; } // featured_products | top_vendors | top_categories | custom_products

        [Required]
        [MaxLength(255)]
        [Column("title")]
        public string Title { get; set; }

        [MaxLength(255)]
        [Column("title_ar")]
        public string? TitleAr { get; set; }

        [MaxLength(500)]
        [Column("subtitle")]
        public string? Subtitle { get; set; }

        [MaxLength(500)]
        [Column("subtitle_ar")]
        public string? SubtitleAr { get; set; }

        [Column("max_items")]
        public int MaxItems { get; set; } = 10;

        // للأقسام المرتبطة بتصنيف أو بائع معين
        [Column("filter_category_id")]
        public Guid? FilterCategoryId { get; set; }

        [Column("filter_vendor_id")]
        public Guid? FilterVendorId { get; set; }

        // صورة بانر تظهر رأساً لقسم المنتجات (العنوان وزر "عرض المزيد" فوقها) — اختيارية
        [MaxLength(500)]
        [Column("banner_image_url")]
        public string? BannerImageUrl { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("display_order")]
        public int DisplayOrder { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public virtual ICollection<HomeSectionItem> Items { get; set; } = new List<HomeSectionItem>();
    }

    // ===================================
    // HomeSectionItem — عناصر القسم (للـ custom فقط)
    // ===================================
    [Table("home_section_items")]
    public class HomeSectionItem
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("section_id")]
        public Guid SectionId { get; set; }

        [Required]
        [Column("entity_id")]
        public Guid EntityId { get; set; }       // productId

        [Column("display_order")]
        public int DisplayOrder { get; set; } = 0;

        // Navigation
        [ForeignKey("SectionId")]
        public virtual HomeSection Section { get; set; }
    }
}