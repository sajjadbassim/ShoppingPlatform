using ecommerce.Core.Constants;
using ecommerce.Core;
using ecommerce.Core.DTO.Cart;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using Microsoft.EntityFrameworkCore;
using ecommerce.Core.Exceptions;

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
                throw new NotFoundException("المستخدم غير موجود");

            var cart = await GetOrCreateCartAsync(userId);
            return await BuildCartResponseAsync(cart);
        }

        // ─────────────────────────────────────────────────────────────────────
        // ADD TO CART
        // ─────────────────────────────────────────────────────────────────────

        public async Task<CartResponseDto> AddToCartAsync(Guid userId, AddToCartDto dto)
        {
            await using var cartLock = await OrderLock.ForCartAsync(_context, userId);
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
                throw new NotFoundException("المستخدم غير موجود");

            var product = await _productRepository.GetByIdAsync(dto.ProductId);
            if (product == null)
                throw new NotFoundException("المنتج غير موجود");

            if (product.IsDeleted)
                throw new BusinessRuleException("هذا المنتج لم يعد متوفراً");

            if (!product.IsActive)
                throw new BusinessRuleException("المنتج غير مفعل");

            // المنتج ذو المتغيرات يُحكم عليه بتوفر المتغير المختار (يُتحقق منه أدناه)
            if (!dto.VariantId.HasValue && !product.IsAvailable)
                throw new BusinessRuleException("المنتج غير متوفر حالياً");

            if (!await _context.Vendors.AnyAsync(v => v.Id == product.VendorId && v.IsActive))
                throw new BusinessRuleException("المتجر غير متاح حالياً");

            // فئة المنتج (أو أحد أسلافها) معطّلة
            if (!await _productRepository.IsPubliclyVisibleAsync(product.Id))
                throw new BusinessRuleException("المنتج غير متاح حالياً");

            // المنتج ذو المتغيرات لا يُضاف بدون اختيار متغير (المخزون والسعر على مستوى المتغير)
            if (!dto.VariantId.HasValue &&
                await _context.ProductVariants.AnyAsync(v => v.ProductId == product.Id))
                throw new BusinessRuleException("يرجى اختيار خيارات المنتج قبل إضافته للسلة");

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
                    throw new NotFoundException("المتغير غير موجود أو لا ينتمي لهذا المنتج");

                if (!variant.IsAvailable)
                    throw new BusinessRuleException("هذا المتغير غير متوفر حالياً");

                if (variant.StockQuantity < dto.Quantity)
                    throw new BusinessRuleException(StockText.Available(variant.StockQuantity, variant: true));
            }
            else
            {
                if (product.StockQuantity < dto.Quantity)
                    throw new BusinessRuleException(StockText.Available(product.StockQuantity));
            }

            var cart = await GetOrCreateCartAsync(userId);

            // ─── البحث بـ ProductId + VariantId معاً ────────────────────────
            var existingItem = await _cartRepository.GetCartItemAsync(cart.Id, dto.ProductId, dto.VariantId);

            if (existingItem != null)
            {
                var newQuantity = existingItem.Quantity + dto.Quantity;
                var maxStock = variant?.StockQuantity ?? product.StockQuantity;

                if (newQuantity > maxStock)
                    throw new BusinessRuleException($"الكمية الإجمالية تتجاوز المخزون المتوفر ({maxStock})");

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
            await using var cartLock = await OrderLock.ForCartAsync(_context, userId);
            var cart = await _cartRepository.GetByUserIdAsync(userId);
            if (cart == null)
                throw new BusinessRuleException("السلة فارغة");

            var cartItem = await _cartRepository.GetCartItemAsync(cart.Id, dto.ProductId, dto.VariantId);
            if (cartItem == null)
                throw new NotFoundException("المنتج غير موجود في السلة");

            var product = await _productRepository.GetByIdAsync(dto.ProductId);
            if (product == null)
                throw new NotFoundException("المنتج غير موجود");

            // التحقق من المخزون — Variant أو Product
            if (dto.VariantId.HasValue && cartItem.Variant != null)
            {
                if (dto.Quantity > cartItem.Variant.StockQuantity)
                    throw new BusinessRuleException(StockText.Available(cartItem.Variant.StockQuantity, variant: true));
            }
            else
            {
                if (dto.Quantity > product.StockQuantity)
                    throw new BusinessRuleException(StockText.Available(product.StockQuantity));
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
            await using var cartLock = await OrderLock.ForCartAsync(_context, userId);
            var cart = await _cartRepository.GetByUserIdAsync(userId);
            if (cart == null)
                throw new BusinessRuleException("السلة فارغة");

            var result = await _cartRepository.RemoveItemAsync(cart.Id, productId, variantId);
            if (!result)
                throw new NotFoundException("المنتج غير موجود في السلة");

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
            var groceryIds = await CategoryVisibility.GetGroceryCategoryIdsAsync(_context);
            // العرض على السعر الكامل للمتغير (الأساسي + فرق المتغير) — كما في الطلب
            var promoPrices = await _promotionService.CalculateFinalPricesAsync(cart.Items.Select(i =>
                new PriceQuery(i.ProductId, i.Product.CategoryId, i.Product.VendorId,
                    i.Product.Price + (i.Variant?.PriceAdjustment ?? 0), i.Id)));

            foreach (var item in cart.Items)
            {
                // ─── السعر النهائي (بعد تطبيق أفضل عرض فعّال على المنتج) ─────
                var originalUnitPrice = item.Variant != null
                    ? item.Product.Price + item.Variant.PriceAdjustment
                    : item.Product.Price;

                var finalPrice = promoPrices[item.Id];

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
                    warnings.Add($"المنتج '{item.Product.NameAr ?? item.Product.Name}' {StockText.Available(stockQty)}");

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
                    WeightStepKg = item.Product.WeightStepKg,
                    IsGrocery = item.Product.CategoryId.HasValue && groceryIds.Contains(item.Product.CategoryId.Value),

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
            var vendorsById = cart.Items.Select(i => i.Product.Vendor).Where(v => v != null).DistinctBy(v => v.Id).ToDictionary(v => v.Id);
            var now = DateTime.UtcNow;
            // متجر السوبرماركت المغلق الآن يقبل طلباً بموعد توصيل ضمن أوقات عمله (إن كانت المواعيد مفعّلة)
            var slotsEnabled = await _context.DeliverySettings.AsNoTracking().Select(s => (bool?)s.GrocerySlotsEnabled).FirstOrDefaultAsync() ?? true;

            foreach (var group in vendorGroups)
            {
                var vendorSubtotal = group.Sum(i => i.Subtotal);
                var firstItem = group.First();
                var meetsMinimum = vendorSubtotal >= firstItem.VendorMinOrderAmount;

                if (!meetsMinimum && firstItem.VendorMinOrderAmount > 0)
                    warnings.Add($"الطلب من '{firstItem.VendorName}' لم يصل للحد الأدنى ({firstItem.VendorMinOrderAmount})");

                totalDeliveryFees += firstItem.VendorDeliveryFee;

                var (isOpen, closedMessage) = vendorsById.TryGetValue(group.Key, out var vendor)
                    ? StoreHours.Status(vendor, now) : (true, null);
                if (!isOpen && vendor!.IsAcceptingOrders && slotsEnabled && group.Any(i => i.IsGrocery))
                    closedMessage = $"{closedMessage} — اختر موعد توصيل ضمن أوقات عمله";
                if (!isOpen)
                    warnings.Add($"متجر '{firstItem.VendorNameAr ?? firstItem.VendorName}': {closedMessage}");

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
                    IsOpen = isOpen,
                    ClosedMessage = closedMessage,
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
                Warnings = warnings,
                HasGroceryItems = items.Any(i => i.IsGrocery)
            };
        }
    }
}