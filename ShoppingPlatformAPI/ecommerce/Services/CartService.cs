using ecommerce.Core;
using ecommerce.Core.DTO.Cart;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services
{
    public class CartService : ICartService
    {
        private readonly ICartRepository _cartRepository;
        private readonly IProductRepository _productRepository;
        private readonly IUserRepository _userRepository;
        private readonly AppDbContext _context;
        private readonly IPromotionService _promotionService;

        public CartService(
            ICartRepository cartRepository,
            IProductRepository productRepository,
            IUserRepository userRepository,
            AppDbContext context,
            IPromotionService promotionService)
        {
            _cartRepository = cartRepository;
            _productRepository = productRepository;
            _userRepository = userRepository;
            _context = context;
            _promotionService = promotionService;
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET CART
        // ─────────────────────────────────────────────────────────────────────

        public async Task<CartResponseDto> GetCartAsync(Guid userId)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
                throw new Exception("المستخدم غير موجود");

            var cart = await GetOrCreateCartAsync(userId);
            return await BuildCartResponseAsync(cart);
        }

        // ─────────────────────────────────────────────────────────────────────
        // ADD TO CART
        // ─────────────────────────────────────────────────────────────────────

        public async Task<CartResponseDto> AddToCartAsync(Guid userId, AddToCartDto dto)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
                throw new Exception("المستخدم غير موجود");

            var product = await _productRepository.GetByIdAsync(dto.ProductId);
            if (product == null)
                throw new Exception("المنتج غير موجود");

            if (product.IsDeleted)
                throw new Exception("هذا المنتج لم يعد متوفراً");

            if (!product.IsActive)
                throw new Exception("المنتج غير مفعل");

            // المنتج ذو المتغيرات يُحكم عليه بتوفر المتغير المختار (يُتحقق منه أدناه)
            if (!dto.VariantId.HasValue && !product.IsAvailable)
                throw new Exception("المنتج غير متوفر حالياً");

            if (!await _context.Vendors.AnyAsync(v => v.Id == product.VendorId && v.IsActive))
                throw new Exception("المتجر غير متاح حالياً");

            // فئة المنتج (أو أحد أسلافها) معطّلة
            if (!await _productRepository.IsPubliclyVisibleAsync(product.Id))
                throw new Exception("المنتج غير متاح حالياً");

            // المنتج ذو المتغيرات لا يُضاف بدون اختيار متغير (المخزون والسعر على مستوى المتغير)
            if (!dto.VariantId.HasValue &&
                await _context.ProductVariants.AnyAsync(v => v.ProductId == product.Id))
                throw new Exception("يرجى اختيار خيارات المنتج قبل إضافته للسلة");

            // ─── التحقق من الـ Variant إذا أُرسل ───────────────────────────
            ProductVariant? variant = null;
            if (dto.VariantId.HasValue)
            {
                variant = await _context.ProductVariants
                    .Include(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                    .FirstOrDefaultAsync(v =>
                        v.Id == dto.VariantId &&
                        v.ProductId == dto.ProductId);

                if (variant == null)
                    throw new Exception("المتغير غير موجود أو لا ينتمي لهذا المنتج");

                if (!variant.IsAvailable)
                    throw new Exception("هذا المتغير غير متوفر حالياً");

                if (variant.StockQuantity < dto.Quantity)
                    throw new Exception($"الكمية المتوفرة من هذا المتغير فقط {variant.StockQuantity}");
            }
            else
            {
                if (product.StockQuantity < dto.Quantity)
                    throw new Exception($"الكمية المتوفرة فقط {product.StockQuantity}");
            }

            var cart = await GetOrCreateCartAsync(userId);

            // ─── البحث بـ ProductId + VariantId معاً ────────────────────────
            var existingItem = await _cartRepository.GetCartItemAsync(cart.Id, dto.ProductId, dto.VariantId);

            if (existingItem != null)
            {
                var newQuantity = existingItem.Quantity + dto.Quantity;
                var maxStock = variant?.StockQuantity ?? product.StockQuantity;

                if (newQuantity > maxStock)
                    throw new Exception($"الكمية الإجمالية تتجاوز المخزون المتوفر ({maxStock})");

                existingItem.Quantity = newQuantity;
                await _cartRepository.UpdateItemAsync(existingItem);
            }
            else
            {
                var cartItem = new CartItem
                {
                    CartId = cart.Id,
                    ProductId = dto.ProductId,
                    VariantId = dto.VariantId,
                    Quantity = dto.Quantity
                };
                await _cartRepository.AddItemAsync(cartItem);
            }

            cart = await _cartRepository.GetByIdAsync(cart.Id);
            return await BuildCartResponseAsync(cart);
        }

        // ─────────────────────────────────────────────────────────────────────
        // UPDATE QUANTITY
        // ─────────────────────────────────────────────────────────────────────

        public async Task<CartResponseDto> UpdateQuantityAsync(Guid userId, UpdateCartItemDto dto)
        {
            var cart = await _cartRepository.GetByUserIdAsync(userId);
            if (cart == null)
                throw new Exception("السلة فارغة");

            var cartItem = await _cartRepository.GetCartItemAsync(cart.Id, dto.ProductId, dto.VariantId);
            if (cartItem == null)
                throw new Exception("المنتج غير موجود في السلة");

            var product = await _productRepository.GetByIdAsync(dto.ProductId);
            if (product == null)
                throw new Exception("المنتج غير موجود");

            // التحقق من المخزون — Variant أو Product
            if (dto.VariantId.HasValue && cartItem.Variant != null)
            {
                if (dto.Quantity > cartItem.Variant.StockQuantity)
                    throw new Exception($"الكمية المتوفرة من هذا المتغير فقط {cartItem.Variant.StockQuantity}");
            }
            else
            {
                if (dto.Quantity > product.StockQuantity)
                    throw new Exception($"الكمية المتوفرة فقط {product.StockQuantity}");
            }

            cartItem.Quantity = dto.Quantity;
            await _cartRepository.UpdateItemAsync(cartItem);

            cart = await _cartRepository.GetByIdAsync(cart.Id);
            return await BuildCartResponseAsync(cart);
        }

        // ─────────────────────────────────────────────────────────────────────
        // REMOVE FROM CART
        // ─────────────────────────────────────────────────────────────────────

        public async Task<CartResponseDto> RemoveFromCartAsync(Guid userId, Guid productId, Guid? variantId = null)
        {
            var cart = await _cartRepository.GetByUserIdAsync(userId);
            if (cart == null)
                throw new Exception("السلة فارغة");

            var result = await _cartRepository.RemoveItemAsync(cart.Id, productId, variantId);
            if (!result)
                throw new Exception("المنتج غير موجود في السلة");

            cart = await _cartRepository.GetByIdAsync(cart.Id);
            return await BuildCartResponseAsync(cart);
        }

        // ─────────────────────────────────────────────────────────────────────
        // CLEAR CART
        // ─────────────────────────────────────────────────────────────────────

        public async Task<bool> ClearCartAsync(Guid userId)
        {
            var cart = await _cartRepository.GetByUserIdAsync(userId);
            if (cart == null)
                return false;

            // ✅ عملية idempotent: سلة فارغة بالفعل = نجاح (نفس النتيجة المطلوبة)، وليس فشلاً
            await _cartRepository.ClearCartAsync(cart.Id);
            return true;
        }

        // ─────────────────────────────────────────────────────────────────────
        // HELPER — GetOrCreate
        // ─────────────────────────────────────────────────────────────────────

        private async Task<Cart> GetOrCreateCartAsync(Guid userId)
        {
            var cart = await _cartRepository.GetByUserIdAsync(userId);
            if (cart == null)
            {
                cart = new Cart { UserId = userId };
                cart = await _cartRepository.CreateAsync(cart);
            }
            return cart;
        }

        // ─────────────────────────────────────────────────────────────────────
        // HELPER — Build Response
        // ─────────────────────────────────────────────────────────────────────

        private async Task<CartResponseDto> BuildCartResponseAsync(Cart cart)
        {
            if (cart?.Items == null || !cart.Items.Any())
            {
                return new CartResponseDto
                {
                    CartId = cart?.Id ?? Guid.Empty,
                    Items = new List<CartItemDto>(),
                    TotalItems = 0,
                    Subtotal = 0,
                    TotalDeliveryFees = 0,
                    TotalAmount = 0,
                    VendorsSummary = new List<VendorCartSummary>(),
                    Warnings = new List<string>()
                };
            }

            var warnings = new List<string>();
            var items = new List<CartItemDto>();

            // المنتجات التي لها متغيرات — عنصر منها بلا متغير لا يمكن طلبه
            var productIds = cart.Items.Select(i => i.ProductId).Distinct().ToList();
            var productsWithVariants = (await _context.ProductVariants
                    .Where(v => productIds.Contains(v.ProductId))
                    .Select(v => v.ProductId)
                    .Distinct()
                    .ToListAsync())
                .ToHashSet();
            var hiddenCategoryIds = await CategoryVisibility.GetHiddenCategoryIdsAsync(_context);

            foreach (var item in cart.Items)
            {
                // ─── السعر النهائي (بعد تطبيق أفضل عرض فعّال على المنتج) ─────
                var promoPrice = await _promotionService.CalculateFinalPriceAsync(
                    item.ProductId,
                    item.Product.CategoryId ?? Guid.Empty,
                    item.Product.VendorId,
                    item.Product.Price);

                var originalUnitPrice = item.Variant != null
                    ? item.Product.Price + item.Variant.PriceAdjustment
                    : item.Product.Price;

                var finalPrice = item.Variant != null
                    ? promoPrice + item.Variant.PriceAdjustment
                    : promoPrice;

                var hasPromoDiscount = finalPrice < originalUnitPrice;

                // ─── المخزون والتوفر ─────────────────────────────────────────
                var stockQty = item.Variant?.StockQuantity ?? item.Product.StockQuantity;
                var needsVariant = item.Variant == null && productsWithVariants.Contains(item.ProductId);
                var vendorActive = item.Product.Vendor?.IsActive ?? false;
                var categoryHidden = item.Product.CategoryId.HasValue && hiddenCategoryIds.Contains(item.Product.CategoryId.Value);
                var isAvailable = vendorActive && !categoryHidden && !needsVariant && (item.Variant != null
                    ? item.Variant.IsAvailable && item.Product.IsActive
                    : item.Product.IsAvailable && item.Product.IsActive);

                // ─── تحذيرات ────────────────────────────────────────────────
                if (needsVariant)
                    warnings.Add($"المنتج '{item.Product.NameAr ?? item.Product.Name}' يحتاج اختيار الخيارات — احذفه وأضفه من صفحة المنتج");
                else if (!isAvailable)
                    warnings.Add($"المنتج '{item.Product.NameAr ?? item.Product.Name}' غير متوفر حالياً");

                if (item.Quantity > stockQty)
                    warnings.Add($"المنتج '{item.Product.NameAr ?? item.Product.Name}' الكمية المتوفرة فقط {stockQty}");

                // ─── بناء الـ DTO ────────────────────────────────────────────
                items.Add(new CartItemDto
                {
                    Id = item.Id,
                    ProductId = item.ProductId,
                    ProductName = item.Product.Name,
                    ProductNameAr = item.Product.NameAr,
                    ProductImage = item.Variant?.ImageUrl
                        ?? item.Product.Images?.FirstOrDefault(img => img.IsPrimary)?.ImageUrl
                        ?? item.Product.Images?.FirstOrDefault()?.ImageUrl,

                    Price = finalPrice,
                    OriginalPrice = item.Product.OriginalPrice ?? (hasPromoDiscount ? originalUnitPrice : (decimal?)null),
                    Quantity = item.Quantity,
                    Subtotal = finalPrice * item.Quantity,
                    IsAvailable = isAvailable,
                    StockQuantity = stockQty,

                    // ─── Variant ─────────────────────────────────────────────
                    VariantId = item.VariantId,
                    VariantSku = item.Variant?.Sku,
                    VariantPriceAdjustment = item.Variant?.PriceAdjustment,
                    VariantAttributes = item.Variant?.AttributeValues?
                        .OrderBy(av => av.AttributeValue?.Attribute?.DisplayOrder)
                        .Select(av => new VariantAttributeInfo
                        {
                            AttributeName = av.AttributeValue?.Attribute?.Name ?? "",
                            AttributeNameAr = av.AttributeValue?.Attribute?.NameAr ?? "",
                            Value = av.AttributeValue?.Value ?? "",
                            ValueAr = av.AttributeValue?.ValueAr ?? ""
                        }).ToList() ?? new(),

                    // ─── Vendor ──────────────────────────────────────────────
                    VendorId = item.Product.VendorId,
                    VendorName = item.Product.Vendor?.Name,
                    VendorNameAr = item.Product.Vendor?.NameAr,
                    VendorDeliveryFee = item.Product.Vendor?.DeliveryFee ?? 0,
                    VendorMinOrderAmount = item.Product.Vendor?.MinOrderAmount ?? 0,

                    // ─── Category ────────────────────────────────────────────
                    CategoryId = item.Product.CategoryId,
                    CategoryName = item.Product.Category?.Name
                });
            }

            // ─── تجميع حسب المتجر ────────────────────────────────────────────
            var vendorGroups = items.GroupBy(i => i.VendorId);
            var vendorsSummary = new List<VendorCartSummary>();
            decimal totalDeliveryFees = 0;

            foreach (var group in vendorGroups)
            {
                var vendorSubtotal = group.Sum(i => i.Subtotal);
                var firstItem = group.First();
                var meetsMinimum = vendorSubtotal >= firstItem.VendorMinOrderAmount;

                if (!meetsMinimum && firstItem.VendorMinOrderAmount > 0)
                    warnings.Add($"الطلب من '{firstItem.VendorName}' لم يصل للحد الأدنى ({firstItem.VendorMinOrderAmount})");

                totalDeliveryFees += firstItem.VendorDeliveryFee;

                vendorsSummary.Add(new VendorCartSummary
                {
                    VendorId = group.Key,
                    VendorName = firstItem.VendorName,
                    VendorNameAr = firstItem.VendorNameAr,
                    DeliveryFee = firstItem.VendorDeliveryFee,
                    MinOrderAmount = firstItem.VendorMinOrderAmount,
                    ItemsCount = group.Count(),
                    Subtotal = vendorSubtotal,
                    MeetsMinimum = meetsMinimum,
                    Items = group.ToList()
                });
            }

            var subtotal = items.Sum(i => i.Subtotal);

            return new CartResponseDto
            {
                CartId = cart.Id,
                Items = items,
                TotalItems = items.Sum(i => i.Quantity),
                Subtotal = subtotal,
                TotalDeliveryFees = totalDeliveryFees,
                TotalAmount = subtotal + totalDeliveryFees,
                VendorsSummary = vendorsSummary,
                Warnings = warnings
            };
        }
    }
}