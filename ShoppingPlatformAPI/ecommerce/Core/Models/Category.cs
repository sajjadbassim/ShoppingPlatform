using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    public class Category
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

        [Column("description")]
        public string Description { get; set; }

        [Column("icon_url")]
        public string IconUrl { get; set; }

        [Column("parent_id")]
        public Guid? ParentId { get; set; }

        [Column("display_order")]
        public int DisplayOrder { get; set; } = 0;

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

      
        public virtual Category ParentCategory { get; set; }
        public virtual ICollection<Category> SubCategories { get; set; } = new List<Category>();

        public virtual ICollection<Product> Products { get; set; }


    }
}
