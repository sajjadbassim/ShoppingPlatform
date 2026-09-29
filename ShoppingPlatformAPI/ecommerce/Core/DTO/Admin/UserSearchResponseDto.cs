namespace ecommerce.Core.DTO.Admin
{
    // نتيجة خفيفة لمنتقي المستخدمين (بدون إحصائيات الطلبات)
    public class UserSearchResponseDto
    {
        public Guid Id { get; set; }
        public string Phone { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string? Email { get; set; }
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
    }
}
