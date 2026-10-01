using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    // اشتراك جهاز في إشعارات الدفع (Web Push) — يصل الإشعار والتطبيق مغلق أو الشاشة مطفأة
    [Table("push_subscriptions")]
    public class PushSubscription
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("user_id")]
        public Guid UserId { get; set; }

        // عنوان خدمة الدفع الخاص بالمتصفح (Apple/Google/Mozilla) — فريد لكل جهاز ومتصفح
        [Required]
        [MaxLength(700)]
        [Column("endpoint")]
        public string Endpoint { get; set; }

        [Required]
        [MaxLength(200)]
        [Column("p256dh")]
        public string P256dh { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("auth")]
        public string Auth { get; set; }

        [MaxLength(300)]
        [Column("user_agent")]
        public string? UserAgent { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("last_used_at")]
        public DateTime? LastUsedAt { get; set; }

        [ForeignKey("UserId")]
        public virtual User User { get; set; }
    }
}
