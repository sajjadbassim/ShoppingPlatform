namespace ecommerce.Core.Models
{
    // رمز تجديد الجلسة: يُعطى للعميل مرة واحدة ويُخزَّن هنا مُجزّأً (SHA-256) فقط.
    // كل تجديد يُبطل الرمز ويصدر غيره (rotation)؛ استعمال رمز مُبطَل = سرقة محتملة فتُبطل كل جلسات المستخدم
    public class RefreshToken
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public string TokenHash { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; }
        public DateTime? RevokedAt { get; set; }
        // وقت استبداله بتجديد — يميّز التجديد المتزامن من تبويبين عن إعادة استعمال رمز مسروق
        public DateTime? ReplacedAt { get; set; }

        public virtual User User { get; set; } = null!;
    }
}
