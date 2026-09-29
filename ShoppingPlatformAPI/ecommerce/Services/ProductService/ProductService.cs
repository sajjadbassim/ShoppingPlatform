using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Product;
using ecommerce.Core.Models;
using ecommerce.Core.DTO.Inventory;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services.FileService;
using ecommerce.Services.InventoryService;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services.ProductService.ProductService
{
    public class ProductService : IProductService
    {
        private readonly IProductRepository _productRepository;
        private readonly IVendorRepository _vendorRepository;
        private readonly IProductImageRepository _imageRepository;
        private readonly IFileService _fileService;
        private readonly AppDbContext _context;
        private readonly IPromotionRepository _promotionRepository;
        private readonly IInventoryService _inventoryService;

        public ProductService(
            IProductRepository productRepository,
            IVendorRepository vendorRepository,
            IProductImageRepository imageRepository,
            IFileService fileService,
            AppDbContext context,
            IPromotionRepository promotionRepository,
            IInventoryService inventoryService)
        {
            _productRepository = productRepository;
            _vendorRepository = vendorRepository;
            _imageRepository = imageRepository;
            _fileService = fileService;
            _context = context;
            _promotionRepository = promotionRepository;
            _inventoryService = inventoryService;
        }

        // ===================================
        // GetByIdAsync
        // ===================================
        public async Task<ProductDto> GetByIdAsync(Guid id)
        {
            var product = await _productRepository.GetByIdWithDetailsAsync(id);
            if (product == null)
                throw new Exception("المنتج غير موجود");

            var images = await _imageRepository.GetByProductIdAsync(id);

            var dto = new ProductDto
            {
                Id = product.Id,
                VendorId = product.VendorId,
                VendorName = product.Vendor?.Name,
                CategoryId = product.CategoryId,
                CategoryName = product.Category?.Name,
                Name = product.Name,
                NameAr = product.NameAr,
                Description = product.Description,
                Price = product.Price,
                OriginalPrice = product.OriginalPrice,
                Sku = product.Sku,
                StockQuantity = product.StockQuantity,
                IsAvailable = product.IsAvailable,
                IsActive = product.IsActive,
                CreatedAt = product.CreatedAt,
                UpdatedAt = product.UpdatedAt,
                Images = images.Select(i => new ProductImageDto
                {
                    Id = i.Id,
                    ImageUrl = i.ImageUrl,
                    IsPrimary = i.IsPrimary,
                    DisplayOrder = i.DisplayOrder
                }).ToList()
            };

            await ApplyPromotionAsync(dto, product);
            return dto;
        }

        // ===================================
        // GetAllAsync
        // ===================================
        public async Task<IEnumerable<ProductDto>> GetAllAsync()
        {
            var products = await _productRepository.GetAllAsync();
            var dtos = products.Select(MapToDto).ToList();
            await ApplyPromotionsBatchAsync(dtos, products.ToList());
            return dtos;
        }

        // ===================================
        // GetByVendorAsync
        // ===================================
        public async Task<IEnumerable<ProductDto>> GetByVendorAsync(Guid vendorId)
        {
            var products = await _productRepository.GetByVendorAsync(vendorId);
            var dtos = products.Select(MapToDto).ToList();
            await ApplyPromotionsBatchAsync(dtos, products.ToList());
            return dtos;
        }

        // ===================================
        // GetByCategoryAsync
        // ===================================
        public async Task<IEnumerable<ProductDto>> GetByCategoryAsync(Guid categoryId)
        {
            var products = await _productRepository.GetByCategoryAsync(categoryId);
            var dtos = products.Select(MapToDto).ToList();
            await ApplyPromotionsBatchAsync(dtos, products.ToList());
            return dtos;
        }

        // ===================================
        // SearchAsync
        // ===================================
        public async Task<IEnumerable<ProductDto>> SearchAsync(string searchTerm)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                return await GetAllAsync();

            var products = await _productRepository.SearchAsync(searchTerm);
            var dtos = products.Select(MapToDto).ToList();
            await ApplyPromotionsBatchAsync(dtos, products.ToList());
            return dtos;
        }

        // ===================================
        // GetFilteredAsync
        // ===================================
        public async Task<(IEnumerable<ProductDto> Products, int TotalCount)> GetFilteredAsync(ProductFilterDto filter)
        {
            var skip = (filter.PageNumber - 1) * filter.PageSize;

            var products = await _productRepository.GetFilteredAsync(
                filter.VendorId, filter.CategoryId, filter.SearchTerm,
                filter.MinPrice, filter.MaxPrice, filter.IsAvailable,
                filter.IsActive, skip, filter.PageSize);

            var totalCount = await _productRepository.GetCountAsync(
                filter.VendorId, filter.CategoryId, filter.SearchTerm,
                filter.MinPrice, filter.MaxPrice, filter.IsAvailable, filter.IsActive);

            var dtos = products.Select(MapToDto).ToList();
            await ApplyPromotionsBatchAsync(dtos, products.ToList());

            return (dtos, totalCount);
        }

        // ===================================
        // GetProductsPagedAsync
        // ===================================
        public async Task<PagedResponse<ProductDto>> GetProductsPagedAsync(
            Guid? vendorId = null,
            Guid? categoryId = null,
            string searchTerm = null,
            decimal? minPrice = null,
            decimal? maxPrice = null,
            bool? isAvailable = null,
            bool? isActive = null,
            int pageNumber = 1,
            int pageSize = 20)
        {
            var pagedProducts = await _productRepository.GetPagedAsync(
                vendorId, categoryId, searchTerm,
                minPrice, maxPrice, isAvailable, isActive,
                pageNumber, pageSize);

            var dtos = pagedProducts.Items.Select(MapToDto).ToList();
            await ApplyPromotionsBatchAsync(dtos, pagedProducts.Items.ToList());

            return new PagedResponse<ProductDto>(
                dtos,
                pagedProducts.TotalCount,
                pagedProducts.PageNumber,
                pagedProducts.PageSize);
        }

        // ===================================
        // ✅ جديد: GetAdvancedFilteredAsync
        // ===================================
        public async Task<PagedResponse<ProductDto>> GetAdvancedFilteredAsync(ProductFilterDto filter)
        {
            var pagedProducts = await _productRepository.GetAdvancedFilteredAsync(
                vendorId: filter.VendorId,
                categoryId: filter.CategoryId,
                searchTerm: filter.SearchTerm,
                minPrice: filter.MinPrice,
                maxPrice: filter.MaxPrice,
                isAvailable: filter.IsAvailable,
                isActive: filter.IsActive,
                minRating: filter.MinRating,
                hasDiscount: filter.HasDiscount,
                sortBy: filter.SortBy,
                sortOrder: filter.SortOrder,
                pageNumber: filter.PageNumber,
                pageSize: filter.PageSize);

            var dtos = pagedProducts.Items.Select(MapToDto).ToList();
            await ApplyPromotionsBatchAsync(dtos, pagedProducts.Items.ToList());

            return new PagedResponse<ProductDto>(
                dtos,
                pagedProducts.TotalCount,
                pagedProducts.PageNumber,
                pagedProducts.PageSize);
        }

        // ===================================
        // ✅ جديد: UnifiedSearchAsync
        // ===================================
        public async Task<UnifiedSearchResult> UnifiedSearchAsync(string searchTerm, int maxResults = 5)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                throw new Exception("كلمة البحث مطلوبة");

            return await _productRepository.UnifiedSearchAsync(searchTerm, maxResults);
        }

        // ===================================
        // CreateAsync
        // ===================================
        public async Task<ProductDto> CreateAsync(CreateProductDto dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var product = new Product
                {
                    VendorId = dto.VendorId,
                    CategoryId = dto.CategoryId,
                    Name = dto.Name,
                    NameAr = dto.NameAr,
                    Description = dto.Description,
                    Price = dto.Price,
                    OriginalPrice = dto.OriginalPrice,
                    Sku = dto.Sku,
                    StockQuantity = dto.StockQuantity,
                    IsAvailable = dto.IsAvailable,
                    IsActive = dto.IsActive
                };

                var createdProduct = await _productRepository.CreateAsync(product);

                if (dto.Images != null && dto.Images.Count > 0)
                {
                    if (dto.Images.Count > 5)
                    {
                        await transaction.RollbackAsync();
                        throw new Exception("لا يمكن رفع أكثر من 5 صور للمنتج");
                    }

                    List<string> uploadedImages = new List<string>();

                    try
                    {
                        uploadedImages = await _fileService.SaveImagesAsync(dto.Images);

                        var productImages = new List<ProductImage>();
                        for (int i = 0; i < uploadedImages.Count; i++)
                        {
                            productImages.Add(new ProductImage
                            {
                                ProductId = createdProduct.Id,
                                ImageUrl = uploadedImages[i],
                                IsPrimary = i == 0,
                                DisplayOrder = i
                            });
                        }

                        await _imageRepository.CreateManyAsync(productImages);
                    }
                    catch (Exception ex)
                    {
                        await _fileService.DeleteImagesAsync(uploadedImages);
                        await transaction.RollbackAsync();
                        throw new Exception($"فشل رفع الصور: {ex.Message}");
                    }
                }

                await transaction.CommitAsync();
                return await GetByIdAsync(createdProduct.Id);
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // ===================================
        // UpdateAsync
        // ===================================
        public async Task<ProductDto> UpdateAsync(Guid id, UpdateProductDto dto)
        {
            var product = await _productRepository.GetByIdAsync(id);
            if (product == null)
                throw new Exception("المنتج غير موجود");

            var previousStock = product.StockQuantity;

            if (!string.IsNullOrWhiteSpace(dto.Name)) product.Name = dto.Name;
            if (!string.IsNullOrWhiteSpace(dto.NameAr)) product.NameAr = dto.NameAr;
            if (!string.IsNullOrWhiteSpace(dto.Description)) product.Description = dto.Description;
            if (dto.CategoryId.HasValue) product.CategoryId = dto.CategoryId;
            if (dto.Price.HasValue) product.Price = dto.Price.Value;
            if (dto.OriginalPrice.HasValue) product.OriginalPrice = dto.OriginalPrice;
            if (!string.IsNullOrWhiteSpace(dto.Sku)) product.Sku = dto.Sku;
            if (dto.StockQuantity.HasValue) product.StockQuantity = dto.StockQuantity.Value;
            if (dto.IsAvailable.HasValue) product.IsAvailable = dto.IsAvailable.Value;
            if (dto.IsActive.HasValue) product.IsActive = dto.IsActive.Value;

            product.UpdatedAt = DateTime.UtcNow;

            if (dto.NewImages != null && dto.NewImages.Count > 0)
            {
                var existingImages = await _imageRepository.GetByProductIdAsync(id);
                if (existingImages.Count + dto.NewImages.Count > 5)
                    throw new Exception("لا يمكن أن يحتوي المنتج على أكثر من 5 صور");

                var imageUrls = await _fileService.SaveImagesAsync(dto.NewImages);
                var productImages = new List<ProductImage>();
                var currentMaxOrder = existingImages.Any() ? existingImages.Max(i => i.DisplayOrder) : -1;

                for (int i = 0; i < imageUrls.Count; i++)
                {
                    productImages.Add(new ProductImage
                    {
                        ProductId = id,
                        ImageUrl = imageUrls[i],
                        IsPrimary = existingImages.Count == 0 && i == 0,
                        DisplayOrder = currentMaxOrder + i + 1
                    });
                }

                await _imageRepository.CreateManyAsync(productImages);
            }

            await _productRepository.UpdateAsync(product);
            await NotifyIfStockBecameLowAsync(product, previousStock);
            return await GetByIdAsync(id);
        }

        // ===================================
        // UpdateStockAsync
        // ===================================
        public async Task<bool> UpdateStockAsync(Guid id, int quantity)
        {
            if (quantity < 0)
                throw new Exception("الكمية لا يمكن أن تكون سالبة");

            var product = await _productRepository.GetByIdAsync(id);
            var previousStock = product?.StockQuantity;

            var updated = await _productRepository.UpdateStockAsync(id, quantity);

            if (updated && product != null && previousStock.HasValue)
            {
                product.StockQuantity = quantity;
                await NotifyIfStockBecameLowAsync(product, previousStock.Value);
            }

            return updated;
        }

        // تنبيه نقص المخزون (قاعدة عبور الحد موحّدة داخل InventoryService)
        private Task NotifyIfStockBecameLowAsync(Product product, int previousStock) =>
            _inventoryService.NotifyLowStockAsync(new[]
            {
                new StockChange(product.Id, null, previousStock, product.StockQuantity)
            });

        // ===================================
        // AddImageAsync
        // ===================================
        public async Task<ProductImageDto> AddImageAsync(Guid productId, IFormFile image)
        {
            var product = await _productRepository.GetByIdAsync(productId);
            if (product == null)
                throw new Exception("المنتج غير موجود");

            var existingImages = await _imageRepository.GetByProductIdAsync(productId);
            if (existingImages.Count >= 5)
                throw new Exception("لا يمكن إضافة أكثر من 5 صور للمنتج");

            var imageUrl = await _fileService.SaveImageAsync(image);
            var productImage = new ProductImage
            {
                ProductId = productId,
                ImageUrl = imageUrl,
                IsPrimary = existingImages.Count == 0,
                DisplayOrder = existingImages.Count
            };

            var created = await _imageRepository.CreateAsync(productImage);

            return new ProductImageDto
            {
                Id = created.Id,
                ImageUrl = created.ImageUrl,
                IsPrimary = created.IsPrimary,
                DisplayOrder = created.DisplayOrder
            };
        }

        // ===================================
        // DeleteImageAsync
        // ===================================
        public async Task<bool> DeleteImageAsync(Guid imageId)
        {
            var image = await _imageRepository.GetByIdAsync(imageId);
            if (image == null)
                return false;

            await _fileService.DeleteImageAsync(image.ImageUrl);
            return await _imageRepository.DeleteAsync(imageId);
        }

        // ===================================
        // SetPrimaryImageAsync
        // ===================================
        public async Task<bool> SetPrimaryImageAsync(Guid imageId, Guid productId)
        {
            return await _imageRepository.SetPrimaryImageAsync(imageId, productId);
        }

        // ===================================
        // DeleteAsync
        // ===================================
        public async Task<bool> DeleteAsync(Guid id)
        {
            var product = await _productRepository.GetByIdAsync(id);
            if (product == null)
                return false;

            var images = await _imageRepository.GetByProductIdAsync(id);
            var imageUrls = images.Select(i => i.ImageUrl).ToList();
            await _fileService.DeleteImagesAsync(imageUrls);
            await _imageRepository.DeleteByProductIdAsync(id);

            return await _productRepository.DeleteAsync(id);
        }

        // ===================================
        // Private: ApplyPromotionAsync (منتج واحد)
        // ===================================
        private async Task ApplyPromotionAsync(ProductDto dto, Product product)
        {
            var categoryId = product.CategoryId ?? Guid.Empty;

            var promotion = await _promotionRepository.GetBestPromotionForProductAsync(
                product.Id, categoryId, product.VendorId);

            if (promotion == null)
                return;

            var basePrice = product.OriginalPrice ?? product.Price;

            decimal discountAmount;
            if (promotion.DiscountType == "percentage")
            {
                discountAmount = basePrice * (promotion.DiscountValue / 100);
                if (promotion.MaxDiscountAmount.HasValue)
                    discountAmount = Math.Min(discountAmount, promotion.MaxDiscountAmount.Value);
            }
            else
            {
                discountAmount = Math.Min(promotion.DiscountValue, basePrice);
            }

            discountAmount = Math.Round(discountAmount, 2);

            dto.OriginalPrice = basePrice;
            dto.Price = Math.Round(basePrice - discountAmount, 2);
            dto.HasPromotion = true;
            dto.PromotionName = promotion.Name;
            dto.PromotionNameAr = promotion.NameAr;
            dto.PromotionExpiresAt = promotion.ExpiresAt;
        }

        // ===================================
        // Private: ApplyPromotionsBatchAsync (قائمة منتجات)
        // ===================================
        private async Task ApplyPromotionsBatchAsync(List<ProductDto> dtos, List<Product> products)
        {
            if (!dtos.Any())
                return;

            var activePromotions = await _promotionRepository.GetActivePromotionsAsync();
            if (!activePromotions.Any())
                return;

            var promotionList = activePromotions.ToList();

            for (int i = 0; i < dtos.Count; i++)
            {
                var dto = dtos[i];
                var product = products[i];
                var categoryId = product.CategoryId ?? Guid.Empty;

                var promotion =
                    promotionList.FirstOrDefault(p => p.TargetType == "product" && p.TargetId == product.Id) ??
                    promotionList.FirstOrDefault(p => p.TargetType == "category" && p.TargetId == categoryId) ??
                    promotionList.FirstOrDefault(p => p.TargetType == "vendor" && p.TargetId == product.VendorId) ??
                    promotionList.FirstOrDefault(p => p.TargetType == "all");

                if (promotion == null)
                    continue;

                var basePrice = product.OriginalPrice ?? product.Price;

                decimal discountAmount;
                if (promotion.DiscountType == "percentage")
                {
                    discountAmount = basePrice * (promotion.DiscountValue / 100);
                    if (promotion.MaxDiscountAmount.HasValue)
                        discountAmount = Math.Min(discountAmount, promotion.MaxDiscountAmount.Value);
                }
                else
                {
                    discountAmount = Math.Min(promotion.DiscountValue, basePrice);
                }

                discountAmount = Math.Round(discountAmount, 2);

                dto.OriginalPrice = basePrice;
                dto.Price = Math.Round(basePrice - discountAmount, 2);
                dto.HasPromotion = true;
                dto.PromotionName = promotion.Name;
                dto.PromotionNameAr = promotion.NameAr;
                dto.PromotionExpiresAt = promotion.ExpiresAt;
            }
        }

        // ===================================
        // Private: MapToDto
        // ===================================
        private ProductDto MapToDto(Product product)
        {
            return new ProductDto
            {
                Id = product.Id,
                Name = product.Name,
                NameAr = product.NameAr,
                Description = product.Description,
                Price = product.Price,
                OriginalPrice = product.OriginalPrice,
                Sku = product.Sku,
                StockQuantity = product.StockQuantity,
                IsAvailable = product.IsAvailable,
                IsActive = product.IsActive,
                VendorId = product.VendorId,
                VendorName = product.Vendor?.Name,
                CategoryId = product.CategoryId,
                CategoryName = product.Category?.Name,
                CreatedAt = product.CreatedAt,
                UpdatedAt = product.UpdatedAt,
                Images = product.Images?.Select(i => new ProductImageDto
                {
                    Id = i.Id,
                    ImageUrl = i.ImageUrl,
                    IsPrimary = i.IsPrimary,
                    DisplayOrder = i.DisplayOrder
                }).ToList() ?? new List<ProductImageDto>()
            };
        }
    }
}