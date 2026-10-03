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
            if (product == null || product.IsDeleted)
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
                RegularPrice = product.Price,
                RegularOriginalPrice = product.OriginalPrice,
                RegularStockQuantity = product.StockQuantity,
                RegularIsAvailable = product.IsAvailable,
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
            await ApplyVariantStockAsync(new List<ProductDto> { dto });
            return dto;
        }

        public Task<bool> IsPubliclyVisibleAsync(Guid id) => _productRepository.IsPubliclyVisibleAsync(id);

        // ===================================
        // GetAllAsync
        // ===================================
        public async Task<IEnumerable<ProductDto>> GetAllAsync()
        {
            var products = await _productRepository.GetAllAsync();
            var dtos = products.Select(MapToDto).ToList();
            await FinalizeListAsync(dtos, products.ToList());
            return dtos;
        }

        // ===================================
        // GetByVendorAsync
        // ===================================
        public async Task<IEnumerable<ProductDto>> GetByVendorAsync(Guid vendorId, bool includeInactiveVendor = false, bool includeHidden = false)
        {
            var products = await _productRepository.GetByVendorAsync(vendorId, includeInactiveVendor, includeHidden);
            var dtos = products.Select(MapToDto).ToList();
            await FinalizeListAsync(dtos, products.ToList());
            return dtos;
        }

        // ===================================
        // GetByCategoryAsync
        // ===================================
        public async Task<IEnumerable<ProductDto>> GetByCategoryAsync(Guid categoryId)
        {
            var products = await _productRepository.GetByCategoryAsync(categoryId);
            var dtos = products.Select(MapToDto).ToList();
            await FinalizeListAsync(dtos, products.ToList());
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
            await FinalizeListAsync(dtos, products.ToList());
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
            await FinalizeListAsync(dtos, products.ToList());

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
            await FinalizeListAsync(dtos, pagedProducts.Items.ToList());

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
            // السعر الفعلي بعد العرض لا يُحسب في SQL — عند الفلترة/الترتيب بالسعر أو بالخصم مع وجود عروض
            // نحسبه في الذاكرة على بيانات خفيفة ثم نجلب الصفحة المطلوبة فقط
            var sortOrder = filter.SortOrder?.ToLower();
            var priceSort = string.Equals(filter.SortBy, "price", StringComparison.OrdinalIgnoreCase) &&
                            (sortOrder == "asc" || sortOrder == "desc");
            var needsPromoPricing = priceSort || filter.MinPrice > 0 || filter.MaxPrice > 0 || filter.HasDiscount == true;

            if (needsPromoPricing)
            {
                var activePromotions = (await _promotionRepository.GetActivePromotionsAsync()).ToList();
                if (activePromotions.Any())
                    return await GetAdvancedFilteredWithPromotionsAsync(filter, activePromotions, priceSort, sortOrder == "desc");
            }

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
            await FinalizeListAsync(dtos, pagedProducts.Items.ToList());

            return new PagedResponse<ProductDto>(
                dtos,
                pagedProducts.TotalCount,
                pagedProducts.PageNumber,
                pagedProducts.PageSize);
        }

        private async Task<PagedResponse<ProductDto>> GetAdvancedFilteredWithPromotionsAsync(
            ProductFilterDto filter, List<Promotion> activePromotions, bool priceSort, bool descending)
        {
            var pageNumber = filter.PageNumber < 1 ? 1 : filter.PageNumber;
            var pageSize = filter.PageSize < 1 ? 20 : Math.Min(filter.PageSize, 100);

            var candidates = await _productRepository.GetAdvancedFilterCandidatesAsync(
                filter.VendorId, filter.CategoryId, filter.SearchTerm, filter.IsAvailable, filter.IsActive,
                filter.MinRating, filter.SortBy, filter.SortOrder);

            var priced = candidates.Select(c =>
            {
                var promotion = PromotionPricing.SelectBest(activePromotions, c.Id, c.CategoryId, c.VendorId);
                var finalPrice = promotion == null ? c.Price : PromotionPricing.CalculateDiscount(c.Price, promotion).FinalPrice;
                return new { c.Id, FinalPrice = finalPrice, HasDiscount = (c.OriginalPrice ?? c.Price) > finalPrice };
            });

            if (filter.MinPrice > 0) priced = priced.Where(x => x.FinalPrice >= filter.MinPrice.Value);
            if (filter.MaxPrice > 0) priced = priced.Where(x => x.FinalPrice <= filter.MaxPrice.Value);
            if (filter.HasDiscount == true) priced = priced.Where(x => x.HasDiscount);
            if (priceSort)
                priced = descending
                    ? priced.OrderByDescending(x => x.FinalPrice).ThenBy(x => x.Id)
                    : priced.OrderBy(x => x.FinalPrice).ThenBy(x => x.Id);

            var matches = priced.ToList();
            var pageIds = matches.Skip((pageNumber - 1) * pageSize).Take(pageSize).Select(x => x.Id).ToList();

            var products = await _productRepository.GetByIdsWithDetailsAsync(pageIds);
            var dtos = products.Select(MapToDto).ToList();
            await FinalizeListAsync(dtos, products);

            return new PagedResponse<ProductDto>(dtos, matches.Count, pageNumber, pageSize);
        }

        // ===================================
        // ✅ جديد: UnifiedSearchAsync
        // ===================================
        public async Task<UnifiedSearchResult> UnifiedSearchAsync(string searchTerm, int maxResults = 5)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                throw new Exception("كلمة البحث مطلوبة");

            var result = await _productRepository.UnifiedSearchAsync(searchTerm, maxResults);

            // نفس تسعير العروض في بقية القوائم والسلة
            var activePromotions = (await _promotionRepository.GetActivePromotionsAsync()).ToList();
            if (activePromotions.Any())
            {
                foreach (var p in result.Products)
                {
                    var promotion = PromotionPricing.SelectBest(activePromotions, p.Id, p.CategoryId, p.VendorId);
                    if (promotion == null)
                        continue;

                    var referencePrice = p.OriginalPrice ?? p.Price;
                    var (finalPrice, _) = PromotionPricing.CalculateDiscount(p.Price, promotion);

                    p.OriginalPrice = referencePrice;
                    p.Price = finalPrice;
                    p.HasDiscount = referencePrice > finalPrice;
                    p.DiscountPercentage = p.HasDiscount && referencePrice > 0
                        ? Math.Round((referencePrice - finalPrice) / referencePrice * 100, 1)
                        : null;
                }
            }

            return result;
        }

        // ===================================
        // CreateAsync
        // ===================================
        public async Task<ProductDto> CreateAsync(CreateProductDto dto)
        {
            EnsureValidPrices(dto.Price, dto.OriginalPrice);

            if (dto.CategoryId.HasValue)
                await EnsureCategoryAssignableAsync(dto.CategoryId.Value);

            if (dto.Images != null && dto.Images.Count > 5)
                throw new Exception("لا يمكن رفع أكثر من 5 صور للمنتج");

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
                        // التراجع عن المعاملة يتم مرة واحدة في catch الخارجي
                        await _fileService.DeleteImagesAsync(uploadedImages);
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

            if (dto.ClearCategory)
            {
                product.CategoryId = null;
            }
            else if (dto.CategoryId.HasValue && dto.CategoryId != product.CategoryId)
            {
                // التحقق فقط عند تغيير الفئة — منتج في فئة عُطّلت لاحقاً يبقى قابلاً للتعديل
                await EnsureCategoryAssignableAsync(dto.CategoryId.Value);
                product.CategoryId = dto.CategoryId;
            }

            if (dto.Price.HasValue) product.Price = dto.Price.Value;
            if (dto.ClearOriginalPrice) product.OriginalPrice = null;
            else if (dto.OriginalPrice.HasValue) product.OriginalPrice = dto.OriginalPrice;

            if (dto.Price.HasValue || dto.OriginalPrice.HasValue)
                EnsureValidPrices(product.Price, product.OriginalPrice);

            // خفض السعر يجب ألا يجعل سعر أي متغير سالباً
            if (dto.Price.HasValue)
            {
                var minAdjustment = await _context.ProductVariants
                    .Where(v => v.ProductId == id)
                    .MinAsync(v => (decimal?)v.PriceAdjustment);
                if (minAdjustment.HasValue && product.Price + minAdjustment.Value < 0)
                    throw new Exception("السعر الجديد يجعل سعر أحد المتغيرات سالباً");
            }
            if (!string.IsNullOrWhiteSpace(dto.Sku)) product.Sku = dto.Sku;
            if (dto.StockQuantity.HasValue) product.StockQuantity = dto.StockQuantity.Value;
            if (dto.IsAvailable.HasValue) product.IsAvailable = dto.IsAvailable.Value;

            // نفس قاعدة PATCH /stock: نفاد الكمية = غير متوفر (الاختيار الصريح للبائع يُحترم في غير ذلك)
            if (dto.StockQuantity.HasValue && product.StockQuantity != previousStock &&
                !await _context.ProductVariants.AnyAsync(v => v.ProductId == id))
            {
                product.IsAvailable = dto.IsAvailable.HasValue && product.StockQuantity > 0
                    ? dto.IsAvailable.Value
                    : ResolveAvailability(product.IsAvailable, previousStock, product.StockQuantity);
            }
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
            if (product == null)
                return false;

            var previousStock = product.StockQuantity;

            // منتج له متغيرات: المخزون الفعلي على المتغيرات، فلا نغيّر توفر المنتج من مخزونه العام
            var isAvailable = await _context.ProductVariants.AnyAsync(v => v.ProductId == id)
                ? product.IsAvailable
                : ResolveAvailability(product.IsAvailable, previousStock, quantity);

            var updated = await _productRepository.UpdateStockAsync(id, quantity, isAvailable);

            if (updated)
            {
                product.StockQuantity = quantity;
                await NotifyIfStockBecameLowAsync(product, previousStock);
            }

            return updated;
        }

        // الكمية صفر = غير متوفر؛ إعادة التخزين من صفر = متوفر؛ غير ذلك يبقى اختيار البائع (مثل الإخفاء اليدوي)
        private static bool ResolveAvailability(bool current, int previousStock, int newStock) =>
            newStock == 0 ? false
            : previousStock == 0 ? true
            : current;

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
                IsPrimary = existingImages.Count == 0 || !existingImages.Any(i => i.IsPrimary),
                // بعد حذف صور قد يتكرر العدد — نأخذ أكبر ترتيب + 1
                DisplayOrder = existingImages.Any() ? existingImages.Max(i => i.DisplayOrder) + 1 : 0
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

            var wasPrimary = image.IsPrimary;
            var productId = image.ProductId;
            var imageUrl = image.ImageUrl;

            // حذف السجل أولاً — لو فشل لا نكون قد حذفنا الملف
            if (!await _imageRepository.DeleteAsync(imageId))
                return false;

            await _fileService.DeleteImageAsync(imageUrl);

            // حذف الصورة الرئيسية: أول صورة متبقية تصبح رئيسية
            if (wasPrimary)
            {
                var next = (await _imageRepository.GetByProductIdAsync(productId)).FirstOrDefault();
                if (next != null)
                    await _imageRepository.SetPrimaryImageAsync(next.Id, productId);
            }

            return true;
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
            // حذف ناعم (تعطيل) — الصور تبقى لأن المنتج يظهر في سجل الطلبات ويمكن إعادة تفعيله
            return await _productRepository.DeleteAsync(id);
        }

        // ===================================
        // Private: التحقق من الأسعار والفئة
        // ===================================
        private static void EnsureValidPrices(decimal price, decimal? originalPrice)
        {
            // السعر الأصلي يُعرض مشطوباً كخصم، فلا معنى له إن لم يكن أعلى من سعر البيع
            if (originalPrice.HasValue && originalPrice.Value <= price)
                throw new Exception("السعر الأصلي يجب أن يكون أعلى من سعر البيع");
        }

        private async Task EnsureCategoryAssignableAsync(Guid categoryId)
        {
            if (!await _context.Categories.AnyAsync(c => c.Id == categoryId))
                throw new Exception("التصنيف غير موجود");

            if ((await CategoryVisibility.GetHiddenCategoryIdsAsync(_context)).Contains(categoryId))
                throw new Exception("التصنيف غير مفعّل");
        }

        // ===================================
        // Private: ApplyPromotionAsync (منتج واحد)
        // ===================================
        private async Task ApplyPromotionAsync(ProductDto dto, Product product)
        {
            var promotion = await _promotionRepository.GetBestPromotionForProductAsync(
                product.Id, product.CategoryId ?? Guid.Empty, product.VendorId);

            ApplyPromotion(dto, product, promotion);
        }

        // ===================================
        // Private: تجهيز القوائم — العروض + مخزون المتغيرات
        // ===================================
        private async Task FinalizeListAsync(List<ProductDto> dtos, List<Product> products)
        {
            await ApplyPromotionsBatchAsync(dtos, products);
            await ApplyVariantStockAsync(dtos);
        }

        // المنتج ذو المتغيرات: المخزون = مجموع المتغيرات المتوفرة، والتوفر = وجود مخزون فيها
        // (مفتاح "متوفر" العام للمنتج لا يُستخدم هنا؛ الإخفاء هو المفتاح الرئيسي)
        private async Task ApplyVariantStockAsync(List<ProductDto> dtos)
        {
            if (!dtos.Any())
                return;

            var ids = dtos.Select(d => d.Id).ToList();
            var variantStock = await _context.ProductVariants
                .Where(v => ids.Contains(v.ProductId))
                .GroupBy(v => v.ProductId)
                .Select(g => new { ProductId = g.Key, Stock = g.Sum(v => v.IsAvailable ? v.StockQuantity : 0) })
                .ToDictionaryAsync(x => x.ProductId, x => x.Stock);

            foreach (var dto in dtos)
            {
                if (!variantStock.TryGetValue(dto.Id, out var stock))
                    continue;

                dto.HasVariants = true;
                dto.StockQuantity = stock;
                dto.IsAvailable = stock > 0;
            }
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
                var product = products[i];
                var promotion = PromotionPricing.SelectBest(
                    promotionList, product.Id, product.CategoryId, product.VendorId);

                ApplyPromotion(dtos[i], product, promotion);
            }
        }

        // ===================================
        // Private: ApplyPromotion
        // الخصم على Price (نفس حساب السلة والطلب)؛ السعر المشطوب = السعر الأصلي إن وُجد وإلا Price
        // ===================================
        private static void ApplyPromotion(ProductDto dto, Product product, Promotion? promotion)
        {
            if (promotion == null)
                return;

            var (finalPrice, _) = PromotionPricing.CalculateDiscount(product.Price, promotion);

            dto.OriginalPrice = product.OriginalPrice ?? product.Price;
            dto.Price = finalPrice;
            dto.HasPromotion = true;
            dto.PromotionName = promotion.Name;
            dto.PromotionNameAr = promotion.NameAr;
            dto.PromotionExpiresAt = promotion.ExpiresAt;
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
                RegularPrice = product.Price,
                RegularOriginalPrice = product.OriginalPrice,
                RegularStockQuantity = product.StockQuantity,
                RegularIsAvailable = product.IsAvailable,
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