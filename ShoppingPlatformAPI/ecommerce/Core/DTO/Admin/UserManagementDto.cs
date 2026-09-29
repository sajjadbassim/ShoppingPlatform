namespace ecommerce.Core.DTO.Admin
{
    public class UserManagementDto
    {
        public Guid Id { get; set; }
        public string Phone { get; set; }
        public string FullName { get; set; }
        public string Email { get; set; }
        public string Role { get; set; }
        public bool IsActive { get; set; }
        public DateTime? LastLogin { get; set; }
        public DateTime CreatedAt { get; set; }

        // Stats
        public int TotalOrders { get; set; }
        public decimal TotalSpent { get; set; }
    }
}
