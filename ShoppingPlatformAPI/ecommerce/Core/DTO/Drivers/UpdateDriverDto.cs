using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Drivers
{
    public class UpdateDriverDto
    {
        [MaxLength(100)]
        public string? FullName { get; set; }

        [MaxLength(20)]
        public string? Phone { get; set; }

        [MaxLength(100)]
        public string? Email { get; set; }

        public string? VehicleType { get; set; }
        public string? WorkArea { get; set; }
    }
}
