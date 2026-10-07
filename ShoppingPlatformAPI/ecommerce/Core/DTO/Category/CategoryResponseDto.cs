namespace ecommerce.Core.DTO.Category
{
    public class CategoryResponseDto
    {
        public Guid Id { get; set; }

        public string Name { get; set; }

        public string NameAr { get; set; }

        public string Description { get; set; }

        public string IconUrl { get; set; }

        public Guid? ParentId { get; set; }

        public int DisplayOrder { get; set; }

        public bool IsActive { get; set; }
        // العلامة على الفئة نفسها (تُعدَّل من الإدارة)
        public bool IsGrocery { get; set; }
        // القسم الفعلي: grocery إذا كانت الفئة أو أحد أسلافها سوبرماركت، وإلا general
        public string Section { get; set; } = "general";

        public DateTime CreatedAt { get; set; }

        // عدد المنتجات في الفئة وكل فئاتها الفرعية (الفئة الرئيسية لا منتجات مباشرة فيها غالباً)
        public int ProductsCount { get; set; }
    }
}
