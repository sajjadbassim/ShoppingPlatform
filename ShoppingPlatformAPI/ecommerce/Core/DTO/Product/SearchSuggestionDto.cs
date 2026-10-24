namespace ecommerce.Core.DTO.Product
{
    public static class SearchSuggestionTypes
    {
        public const string Product = "product";
        public const string Store = "store";
        public const string Category = "category";
    }

    // اقتراح بحث خفيف (نص فقط) أثناء الكتابة — بديل أرخص من البحث الموحد الذي يعيد بطاقات كاملة
    public class SearchSuggestionDto
    {
        public string Type { get; set; } = SearchSuggestionTypes.Product;
        public Guid Id { get; set; }

        // الاسم المعروض: العربي أولاً
        public string Text { get; set; } = "";

        // للمنتج: اسم المتجر
        public string? Subtitle { get; set; }
    }
}
