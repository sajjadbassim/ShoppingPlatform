using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    [Table("password_reset_otps")]
    public class PasswordResetOtp
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required]
        [MaxLength(255)]
        [Column("code_hash")]
        public string CodeHash { get; set; }

        [Column("expires_at")]
        public DateTime ExpiresAt { get; set; }

        [Column("attempts")]
        public int Attempts { get; set; } = 0;

        [Column("is_verified")]
        public bool IsVerified { get; set; } = false;

        [MaxLength(100)]
        [Column("reset_token")]
        public string? ResetToken { get; set; }

        [Column("reset_token_expires_at")]
        public DateTime? ResetTokenExpiresAt { get; set; }

        [Column("is_used")]
        public bool IsUsed { get; set; } = false;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("UserId")]
        public virtual User User { get; set; }
    }
}
