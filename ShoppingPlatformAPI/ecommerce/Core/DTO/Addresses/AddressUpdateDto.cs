using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Addresses
{
    public class AddressUpdateDto
    {
        [MaxLength(100)]
        public string Label { get; set; }

        [Required]
        public string StreetAddress { get; set; }

        [MaxLength(255)]
        public string Area { get; set; }

        [Required]
        [MaxLength(100)]
        public string City { get; set; }

        [MaxLength(50)]
        public string BuildingNumber { get; set; }

        [MaxLength(50)]
        public string FloorNumber { get; set; }

        [MaxLength(50)]
        public string ApartmentNumber { get; set; }

        [MaxLength(20)]
        public string Phone { get; set; }

        public string Notes { get; set; }

        public bool IsDefault { get; set; }

        public decimal? Latitude { get; set; }

        public decimal? Longitude { get; set; }

    }
}
