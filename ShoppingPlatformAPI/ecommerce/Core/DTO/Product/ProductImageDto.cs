namespace ecommerce.Core.DTO.Product
{
    public class ProductImageDto
    {
        public Guid Id { get; set; }
        public string ImageUrl { get; set; }
        public bool IsPrimary { get; set; }
        public int DisplayOrder { get; set; }
    }
}
