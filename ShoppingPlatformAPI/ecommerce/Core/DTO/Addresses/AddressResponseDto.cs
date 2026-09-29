namespace ecommerce.Core.DTO.Addresses
{
    public class AddressResponseDto
    {
        public Guid Id { get; set; }

        public Guid UserId { get; set; }

        public string Label { get; set; }

        public string StreetAddress { get; set; }

        public string Area { get; set; }

        public string City { get; set; }

        public string BuildingNumber { get; set; }

        public string FloorNumber { get; set; }

        public string ApartmentNumber { get; set; }

        public string Phone { get; set; }

        public string Notes { get; set; }

        public bool IsDefault { get; set; }

        public decimal? Latitude { get; set; }

        public decimal? Longitude { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}
