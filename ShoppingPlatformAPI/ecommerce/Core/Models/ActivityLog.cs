using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Core.Models
{
    // سجل النشاط: كل إجراء يغيّر بيانات ينفّذه أدمن/عمليات/متجر/سائق، ودخولهم (الناجح والفاشل).
    // الزبائن لا يُسجَّلون. سطر لكل طلب HTTP ناجح، وتفاصيله ما تغيّر في قاعدة البيانات (قبل ← بعد)
    [Table("activity_logs")]
    [Index(nameof(At))]
    [Index(nameof(ActorUserId), nameof(At))]
    [Index(nameof(ActorVendorId), nameof(At))]
    public class ActivityLog
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("at")]
        public DateTime At { get; set; } = DateTime.UtcNow;

        // null = محاولة دخول لحساب غير موجود (لا تُسجَّل حالياً)
        [Column("actor_user_id")]
        public Guid? ActorUserId { get; set; }

        [Required, MaxLength(20)]
        [Column("actor_role")]
        public string ActorRole { get; set; } = "";

        [MaxLength(200)]
        [Column("actor_name")]
        public string? ActorName { get; set; }

        // متجر المنفّذ إن كان صاحب متجر — ليرى المتجر نشاطه
        [Column("actor_vendor_id")]
        public Guid? ActorVendorId { get; set; }

        // Controller.Action أو auth.login / auth.login_failed
        [Required, MaxLength(100)]
        [Column("action")]
        public string Action { get; set; } = "";

        // AUTH | ACTION
        [Required, MaxLength(10)]
        [Column("kind")]
        public string Kind { get; set; } = ActivityKind.Action;

        [Required, MaxLength(500)]
        [Column("summary")]
        public string Summary { get; set; } = "";

        // المتاجر التي مسّها الإجراء (",id,id,") — ليرى المتجر ما فعلته الإدارة/العمليات بطلباته ومنتجاته
        [MaxLength(800)]
        [Column("vendor_ids")]
        public string? VendorIds { get; set; }

        // ما تغيّر: [{type,id,state,label,changes:[{p,o,n}]}]
        [Column("details")]
        public string? Details { get; set; }

        [MaxLength(10)]
        [Column("http_method")]
        public string? HttpMethod { get; set; }

        [MaxLength(300)]
        [Column("path")]
        public string? Path { get; set; }

        [MaxLength(64)]
        [Column("ip")]
        public string? Ip { get; set; }

        [MaxLength(300)]
        [Column("user_agent")]
        public string? UserAgent { get; set; }
    }

    public static class ActivityKind
    {
        public const string Auth = "AUTH";
        public const string Action = "ACTION";
    }
}
