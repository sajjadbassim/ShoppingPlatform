namespace ecommerce.Core.DTO.Drivers
{
    public class DriverDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; }
        public string Phone { get; set; }
        public string? Email { get; set; }
        public string VehicleType { get; set; }
        public string? WorkArea { get; set; }
        public string Status { get; set; }
        public string WorkStatus { get; set; }
        public decimal Rating { get; set; }
        public int TotalDeliveries { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool HasAccount { get; set; }          // يستطيع الدخول للوحة السائق
    }
}
