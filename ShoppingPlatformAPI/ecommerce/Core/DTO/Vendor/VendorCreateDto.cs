using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Vendor
{
    public class VendorCreateDto
    {
        [Required]
        [MaxLength(255)]
        public string Name { get; set; }

        [MaxLength(255)]
        public string NameAr { get; set; }

        public string Description { get; set; }

        public IFormFile? Logo { get; set; }

        public IFormFile? Cover { get; set; }

        [MaxLength(20)]
        public string Phone { get; set; }

        public string Address { get; set; }

        public bool IsActive { get; set; } = true;

        [Range(0, double.MaxValue)]
        public decimal MinOrderAmount { get; set; }

        [Range(0, double.MaxValue)]
        public decimal DeliveryFee { get; set; }

        public int? EstimatedPrepTime { get; set; }
    }
}
