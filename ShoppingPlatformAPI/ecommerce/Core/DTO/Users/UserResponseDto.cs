namespace ecommerce.Core.DTO.Users
{
    public class UserResponseDto
    {
        public Guid Id { get; set; }
        public string Phone { get; set; }
        public string FullName { get; set; }
        public string Email { get; set; }
        public string Role { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
