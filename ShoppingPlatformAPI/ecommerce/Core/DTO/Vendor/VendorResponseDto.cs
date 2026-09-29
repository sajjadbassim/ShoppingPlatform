using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Vendor
{
    public class VendorResponseDto
    {
        public Guid Id { get; set; }

        public Guid? OwnerId { get; set; }

        public string Name { get; set; }

        public string NameAr { get; set; }

        public string Description { get; set; }

        public string LogoUrl { get; set; }

        public string CoverImageUrl { get; set; }

        public string Phone { get; set; }

        public string Address { get; set; }

        public bool IsActive { get; set; }

        public decimal MinOrderAmount { get; set; }

        public decimal DeliveryFee { get; set; }

        [Range(1, 1440, ErrorMessage = "وقت التحضير يجب أن يكون بين 1 و 1440 دقيقة")]

        public int? EstimatedPrepTime { get; set; }

        public int ProductsCount { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}
