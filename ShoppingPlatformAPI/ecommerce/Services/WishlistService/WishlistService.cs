using ecommerce.Core.DTO.Wishlist;
using ecommerce.Core.Models;
using ecommerce.Repositories;

namespace ecommerce.Services
{
    public class WishlistService : IWishlistService
    {
        private readonly IWishlistRepository _wishlistRepository;
        private readonly IProductRepository _productRepository;

        public WishlistService(
            IWishlistRepository wishlistRepository,
            IProductRepository productRepository)
        {
            _wishlistRepository = wishlistRepository;
            _productRepository = productRepository;
        }

        public async Task<IEnumerable<WishlistDto>> GetUserWishlistAsync(Guid userId)
        {
            var wishlists = await _wishlistRepository.GetByUserIdAsync(userId);

            return wishlists.Select(w => new WishlistDto
            {
                Id = w.Id,
                UserId = w.UserId,
                ProductId = w.ProductId,
                CreatedAt = w.CreatedAt,
                Product = new ProductWishlistDto
                {
                    Id = w.Product.Id,
                    Name = w.Product.Name,
                    NameAr = w.Product.NameAr,
                    Description = w.Product.Description,
                    Price = w.Product.Price,
                    OriginalPrice = w.Product.OriginalPrice,
                    IsAvailable = w.Product.IsAvailable,
                    StockQuantity = w.Product.StockQuantity,
                    PrimaryImageUrl = w.Product.Images?
                        .FirstOrDefault(i => i.IsPrimary)?.ImageUrl,
                    VendorId = w.Product.VendorId,
                    VendorName = w.Product.Vendor?.Name
                }
            });
        }

        public async Task<WishlistDto> AddToWishlistAsync(Guid userId, AddToWishlistDto dto)
        {
            // التحقق من وجود المنتج
            var product = await _productRepository.GetByIdAsync(dto.ProductId);
            if (product == null)
                throw new Exception("المنتج غير موجود");

            // التحقق من عدم وجود المنتج مسبقاً في المفضلة
            var exists = await _wishlistRepository.ExistsAsync(userId, dto.ProductId);
            if (exists)
                throw new Exception("المنتج موجود بالفعل في قائمة المفضلة");

            var wishlist = new Wishlist
            {
                UserId = userId,
                ProductId = dto.ProductId
            };

            var created = await _wishlistRepository.CreateAsync(wishlist);

            return new WishlistDto
            {
                Id = created.Id,
                UserId = created.UserId,
                ProductId = created.ProductId,
                CreatedAt = created.CreatedAt,
                Product = new ProductWishlistDto
                {
                    Id = created.Product.Id,
                    Name = created.Product.Name,
                    NameAr = created.Product.NameAr,
                    Description = created.Product.Description,
                    Price = created.Product.Price,
                    OriginalPrice = created.Product.OriginalPrice,
                    IsAvailable = created.Product.IsAvailable,
                    StockQuantity = created.Product.StockQuantity,
                    PrimaryImageUrl = created.Product.Images?
                        .FirstOrDefault(i => i.IsPrimary)?.ImageUrl,
                    VendorId = created.Product.VendorId,
                    VendorName = created.Product.Vendor?.Name
                }
            };
        }

        public async Task<bool> RemoveFromWishlistAsync(Guid userId, Guid productId)
        {
            return await _wishlistRepository.DeleteByUserAndProductAsync(userId, productId);
        }

        public async Task<bool> IsInWishlistAsync(Guid userId, Guid productId)
        {
            return await _wishlistRepository.ExistsAsync(userId, productId);
        }

        public async Task<int> GetWishlistCountAsync(Guid userId)
        {
            return await _wishlistRepository.GetCountByUserAsync(userId);
        }

        public async Task<bool> ClearWishlistAsync(Guid userId)
        {
            // ✅ عملية idempotent: قائمة فارغة بالفعل = نجاح، وليس فشلاً
            await _wishlistRepository.ClearUserWishlistAsync(userId);
            return true;
        }

        public async Task<bool> ToggleWishlistAsync(Guid userId, Guid productId)
        {
            var exists = await _wishlistRepository.ExistsAsync(userId, productId);

            if (exists)
            {
                return await _wishlistRepository.DeleteByUserAndProductAsync(userId, productId);
            }
            else
            {
                var product = await _productRepository.GetByIdAsync(productId);
                if (product == null)
                    throw new Exception("المنتج غير موجود");

                var wishlist = new Wishlist
                {
                    UserId = userId,
                    ProductId = productId
                };

                await _wishlistRepository.CreateAsync(wishlist);
                return true;
            }
        }
    }
}