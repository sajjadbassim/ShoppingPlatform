namespace ecommerce.Core.DTO.Wishlist
{
    public class WishlistDto
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public Guid ProductId { get; set; }
        public DateTime CreatedAt { get; set; }

        // معلومات المنتج
        public ProductWishlistDto Product { get; set; }
    }
}
