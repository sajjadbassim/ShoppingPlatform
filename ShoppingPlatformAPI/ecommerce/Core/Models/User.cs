using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Net;

namespace ecommerce.Core.Models
{
    public class User
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();
        [MaxLength(20)]
        [Column("phone")]
        // اختياري: حساب Google يُنشأ بلا هاتف، ويُطلب الهاتف عند أول شراء
        public string? Phone { get; set; }

        [MaxLength(255)]
        [Column("full_name")]
        public string FullName { get; set; }

        [MaxLength(255)]
        [Column("email")]
        public string Email { get; set; }

        [MaxLength(500)]
        [Column("password_hash")]
        public string PasswordHash { get; set; }

        // هل يعرف المستخدم كلمة مروره؟ (حساب أُنشئ بـ Google لا يملك كلمة حتى يضيفها)
        public bool HasPassword { get; set; } = true;

        // حساب Google المربوط (معرّف Google الثابت + بريده وقت الربط)
        [MaxLength(64)]
        public string? GoogleId { get; set; }

        [MaxLength(255)]
        public string? GoogleEmail { get; set; }

        [Column("last_login")]
        public DateTime? LastLogin { get; set; }

        [Required]
        [MaxLength(50)]
        [Column("role")]
        public string Role { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties - سنضيفها لاحقاً
        public virtual ICollection<Address> Addresses { get; set; } = new List<Address>();
        public virtual ICollection<Order> Orders { get; set; }

        public virtual ICollection<OrderStatusLog> StatusChanges { get; set; }
        public virtual ICollection<Wishlist> Wishlists { get; set; }

        // public virtual Cart Cart { get; set; }
    }
}
