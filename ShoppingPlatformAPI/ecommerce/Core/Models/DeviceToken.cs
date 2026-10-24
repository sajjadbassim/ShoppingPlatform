using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    // رمز جهاز موبايل في Firebase Cloud Messaging — يصل الإشعار والتطبيق مغلق
    [Table("device_tokens")]
    [Microsoft.EntityFrameworkCore.Index(nameof(Token), IsUnique = true)]
    [Microsoft.EntityFrameworkCore.Index(nameof(UserId))]
    public class DeviceToken
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("user_id")]
        public Guid UserId { get; set; }

        // رمز FCM: فريد لكل تثبيت للتطبيق، ويتغير عند إعادة التثبيت أو مسح البيانات
        [Required]
        [MaxLength(400)]
        [Column("token")]
        public string Token { get; set; }

        // android | ios
        [Required]
        [MaxLength(10)]
        [Column("platform")]
        public string Platform { get; set; }

        // customer | driver — أي تطبيق سجّل هذا الجهاز
        [Required]
        [MaxLength(20)]
        [Column("app")]
        public string App { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("last_used_at")]
        public DateTime? LastUsedAt { get; set; }

        [ForeignKey("UserId")]
        public virtual User User { get; set; }
    }
}
