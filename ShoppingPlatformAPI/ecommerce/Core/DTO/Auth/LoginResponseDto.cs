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
        // رمز التجديد يُرسل مرة واحدة هنا ولا يُخزَّن في الخادم إلا مُجزّأً
        public string RefreshToken { get; set; }
        public DateTime RefreshTokenExpiresAt { get; set; }
        public Guid? VendorId { get; set; }
        public string? AvatarUrl { get; set; }

        // الحساب المساعد: صلاحياته (null = بلا قيود — صاحب متجر أو أدمن كامل)، وهل هو موظف في متجر غيره
        public List<string>? Permissions { get; set; }
        public bool IsStoreStaff { get; set; }

    }
}
