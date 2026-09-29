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

        public DateTime CreatedAt { get; set; }
    }
}
