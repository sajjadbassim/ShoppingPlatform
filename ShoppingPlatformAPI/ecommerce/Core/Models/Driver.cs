// Core/Models/Driver.cs
using ecommerce.Core.Constants;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    [Table("drivers")]
    [Index(nameof(LocationTokenHash), IsUnique = true)]
    public class Driver
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(100)]
        [Column("full_name")]
        public string FullName { get; set; }

        [Required]
        [MaxLength(20)]
        [Column("phone")]
        public string Phone { get; set; }

        [MaxLength(100)]
        [Column("email")]
        public string? Email { get; set; }

        [Required]
        [MaxLength(50)]
        [Column("vehicle_type")]
        public string VehicleType { get; set; } // motorcycle | car | bicycle

        [MaxLength(100)]
        [Column("work_area")]
        public string? WorkArea { get; set; }

        [Required]
        [MaxLength(20)]
        [Column("status")]
        public string Status { get; set; } = DriverStatus.Active;

        [Required]
        [MaxLength(20)]
        [Column("work_status")]
        public string WorkStatus { get; set; } = DriverWorkStatus.Offline;

        [Column("rating", TypeName = "decimal(3,2)")]
        public decimal Rating { get; set; } = 0;

        [Column("total_deliveries")]
        public int TotalDeliveries { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // ===== التتبع المباشر: آخر موقع فقط (بلا سجل مسارات) يرسله السائق من رابط المشاركة =====
        [Column("last_latitude")]
        public double? LastLatitude { get; set; }

        [Column("last_longitude")]
        public double? LastLongitude { get; set; }

        [Column("last_location_accuracy")]
        public double? LastLocationAccuracy { get; set; }

        [Column("last_location_at")]
        public DateTime? LastLocationAt { get; set; }

        // SHA-256 لرمز رابط المشاركة — الرمز نفسه لا يُحفظ
        [MaxLength(64)]
        [Column("location_token_hash")]
        public string? LocationTokenHash { get; set; }

        // ===== حساب الدخول (دور DRIVER) — فارغ للسائقين بلا حساب =====
        [Column("user_id")]
        public Guid? UserId { get; set; }

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}