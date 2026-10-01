namespace ecommerce.Core.DTO.Auth
{
    public class LoginResponseDto
    {
        public Guid UserId { get; set; }
        public string Phone { get; set; }
        public string FullName { get; set; }
        public string Email { get; set; }
        public string Role { get; set; }
        public string Token { get; set; }
        public DateTime ExpiresAt { get; set; }
        public Guid? VendorId { get; set; }
        public string? AvatarUrl { get; set; }

    }
}
