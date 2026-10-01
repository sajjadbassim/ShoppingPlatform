using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    public class Vendor
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(255)]
        [Column("name")]
        public string Name { get; set; }

        [MaxLength(255)]
        [Column("name_ar")]
        public string NameAr { get; set; }
       
        [MaxLength(255)]
        [Column("description")]
        public string Description { get; set; }

        [Column("logo_url")]
        public string LogoUrl { get; set; }

        [Column("cover_image_url")]
        public string CoverImageUrl { get; set; }

        [MaxLength(20)]
        [Column("phone")]
        public string Phone { get; set; }
        [MaxLength(255)]
        [Column("address")]
        public string Address { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("min_order_amount", TypeName = "decimal(10,2)")]
        public decimal MinOrderAmount { get; set; } = 0;

        [Column("delivery_fee", TypeName = "decimal(10,2)")]
        public decimal DeliveryFee { get; set; } = 0;

        [Column("estimated_prep_time")]
        public int? EstimatedPrepTime { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [Column("owner_id")]
        public Guid? OwnerId { get; set; }

        // عمولة المنصة الخاصة بهذا المتجر — فارغة = الإعداد العام (PERCENTAGE نسبة | FIXED مبلغ لكل طلب)
        [MaxLength(20)]
        [Column("commission_type")]
        public string? CommissionType { get; set; }

        [Column("commission_value", TypeName = "decimal(12,2)")]
        public decimal? CommissionValue { get; set; }

        // Navigation Properties
        public virtual ICollection<Product> Products { get; set; }
        public virtual ICollection<SubOrder> SubOrders { get; set; }
        public virtual User Owner { get; set; }


    }
}
