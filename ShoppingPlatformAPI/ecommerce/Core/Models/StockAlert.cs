namespace ecommerce.Core.Models
{
    // «أعلمني عند التوفر»: زبون طلب إشعاراً حين يعود منتج (أو خيار محدد منه) للمخزون.
    // يُرسل الإشعار مرة واحدة (NotifiedAt) ثم يبقى السجل للتاريخ؛ الاشتراك من جديد يُنشئ سجلاً جديداً
    public class StockAlert
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public Guid ProductId { get; set; }
        public Guid? VariantId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? NotifiedAt { get; set; }

        public virtual User User { get; set; } = null!;
        public virtual Product Product { get; set; } = null!;
    }
}
