using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    public class Address
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("user_id")]
        public Guid UserId { get; set; }

        [MaxLength(100)]
        [Column("label")]
        public string Label { get; set; }

        [Required]
        [Column("street_address")]
        public string StreetAddress { get; set; }

        [MaxLength(255)]
        [Column("area")]
        public string Area { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("city")]
        public string City { get; set; }

        [MaxLength(50)]
        [Column("building_number")]
        public string BuildingNumber { get; set; }

        [MaxLength(50)]
        [Column("floor_number")]
        public string FloorNumber { get; set; }

        [MaxLength(50)]
        [Column("apartment_number")]
        public string ApartmentNumber { get; set; }

        [MaxLength(20)]
        [Column("phone")]
        public string Phone { get; set; }

        [Column("notes")]
        public string Notes { get; set; }

        [Column("is_default")]
        public bool IsDefault { get; set; } = false;

        [Column("latitude", TypeName = "decimal(10,8)")]
        public decimal? Latitude { get; set; }

        [Column("longitude", TypeName = "decimal(11,8)")]
        public decimal? Longitude { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        [ForeignKey("UserId")]
        public virtual User User { get; set; }
        public virtual ICollection<Order> Orders { get; set; }

    }
}
