using ecommerce.Core.DTO.Product;
using ecommerce.Core.Models;
using ecommerce.Core.DTO.Inventory;
using ecommerce.Data;
using ecommerce.Services.InventoryService;
using Microsoft.EntityFrameworkCore;
namespace ecommerce.Services.ProductService

{

        public class VariantService : IVariantService
        {
            private readonly AppDbContext _context;
            private readonly IInventoryService _inventoryService;
            private readonly IPromotionService _promotionService;

            public VariantService(AppDbContext context, IInventoryService inventoryService, IPromotionService promotionService)
            {
                _context = context;
                _inventoryService = inventoryService;
                _promotionService = promotionService;
            }

            // ===================================
            // GetAttributesAsync
            // ===================================
            public async Task<List<ProductAttributeDto>> GetAttributesAsync(Guid productId)
            {
                var product = await _context.Products.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == productId);
                if (product == null)
                    throw new Exception("المنتج غير موجود");

                var attributes = await _context.ProductAttributes
                    .Include(a => a.Values)
                    .Where(a => a.ProductId == productId)
                    .OrderBy(a => a.DisplayOrder)
                    .AsNoTracking()
                    .ToListAsync();

                return attributes.Select(MapAttributeToDto).ToList();
            }

            // ===================================
            // CreateAttributeAsync
            // ===================================
            public async Task<ProductAttributeDto> CreateAttributeAsync(Guid productId, CreateProductAttributeDto dto)
            {
                var product = await _context.Products
                    .FirstOrDefaultAsync(p => p.Id == productId);
                if (product == null)
                    throw new Exception("المنتج غير موجود");

                if (!dto.Values.Any())
                    throw new Exception("يجب إضافة قيمة واحدة على الأقل");

                // كل متغير يحمل قيمة لكل خاصية — خاصية جديدة تجعل المتغيرات الحالية ناقصة لا يمكن اختيارها
                if (await _context.ProductVariants.AnyAsync(v => v.ProductId == productId))
                    throw new Exception("لا يمكن إضافة خاصية جديدة بعد إنشاء متغيرات — احذف المتغيرات أولاً");

                var attribute = new ProductAttribute
                {
                    ProductId = productId,
                    Name = dto.Name,
                    NameAr = dto.NameAr,
                    DisplayOrder = dto.DisplayOrder,
                    Values = dto.Values.Select(v => new ProductAttributeValue
                    {
                        Value = v.Value,
                        ValueAr = v.ValueAr,
                        DisplayOrder = v.DisplayOrder
                    }).ToList()
                };

                await _context.ProductAttributes.AddAsync(attribute);
                await _context.SaveChangesAsync();

                return await GetAttributeWithValuesAsync(attribute.Id);
            }

            // ===================================
            // UpdateAttributeAsync
            // ===================================
            public async Task<ProductAttributeDto> UpdateAttributeAsync(Guid attributeId, UpdateProductAttributeDto dto)
            {
                var attribute = await _context.ProductAttributes
                    .Include(a => a.Values)
                    .FirstOrDefaultAsync(a => a.Id == attributeId);

                if (attribute == null)
                    throw new Exception("الخاصية غير موجودة");

                if (dto.Name != null) attribute.Name = dto.Name;
                if (dto.NameAr != null) attribute.NameAr = dto.NameAr;
                if (dto.DisplayOrder != null) attribute.DisplayOrder = dto.DisplayOrder.Value;

                await _context.SaveChangesAsync();

                return MapAttributeToDto(attribute);
            }

            // ===================================
            // DeleteAttributeAsync
            // ===================================
            public async Task<bool> DeleteAttributeAsync(Guid attributeId)
            {
                var attribute = await _context.ProductAttributes
                    .Include(a => a.Values)
                        .ThenInclude(v => v.VariantValues)
                    .FirstOrDefaultAsync(a => a.Id == attributeId);

                if (attribute == null)
                    return false;

                // قيم الخاصية مرتبطة بمتغيرات — حذفها يكسر تلك المتغيرات
                if (attribute.Values.Any(v => v.VariantValues.Any()))
                    throw new Exception("لا يمكن حذف الخاصية لأنها مستخدمة في متغيرات — احذف تلك المتغيرات أولاً");

                _context.ProductAttributes.Remove(attribute);
                await _context.SaveChangesAsync();
                return true;
            }

            // ===================================
            // AddAttributeValueAsync
            // ===================================
            public async Task<ProductAttributeValueDto> AddAttributeValueAsync(Guid attributeId, CreateAttributeValueDto dto)
            {
                var attribute = await _context.ProductAttributes
                    .FirstOrDefaultAsync(a => a.Id == attributeId);

                if (attribute == null)
                    throw new Exception("الخاصية غير موجودة");

                var value = new ProductAttributeValue
                {
                    AttributeId = attributeId,
                    Value = dto.Value,
                    ValueAr = dto.ValueAr,
                    DisplayOrder = dto.DisplayOrder
                };

                await _context.ProductAttributeValues.AddAsync(value);
                await _context.SaveChangesAsync();

                return MapValueToDto(value);
            }

            // ===================================
            // DeleteAttributeValueAsync
            // ===================================
            public async Task<bool> DeleteAttributeValueAsync(Guid valueId)
            {
                var value = await _context.ProductAttributeValues
                    .Include(v => v.VariantValues)
                    .FirstOrDefaultAsync(v => v.Id == valueId);

                if (value == null)
                    return false;

                // التحقق أن القيمة غير مستخدمة في أي متغير
                if (value.VariantValues.Any())
                    throw new Exception("لا يمكن حذف القيمة لأنها مستخدمة في متغيرات موجودة");

                _context.ProductAttributeValues.Remove(value);
                await _context.SaveChangesAsync();
                return true;
            }

            // ===================================
            // GetVariantsAsync
            // ===================================
            public async Task<List<ProductVariantDto>> GetVariantsAsync(Guid productId)
            {
                var product = await _context.Products.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == productId);
                if (product == null)
                    throw new Exception("المنتج غير موجود");

                var variants = await _context.ProductVariants
                    .Include(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                    .Where(v => v.ProductId == productId)
                    .OrderBy(v => v.DisplayOrder)
                    .AsNoTracking()
                    .ToListAsync();

                var basePrice = await GetEffectiveBasePriceAsync(product);
                return variants.Select(v => MapVariantToDto(v, basePrice)).ToList();
            }

            // ===================================
            // GetVariantByIdAsync
            // ===================================
            public async Task<ProductVariantDto> GetVariantByIdAsync(Guid variantId)
            {
                var variant = await _context.ProductVariants
                    .Include(v => v.Product)
                    .Include(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(v => v.Id == variantId);

                if (variant == null)
                    throw new Exception("المتغير غير موجود");

                return MapVariantToDto(variant, await GetEffectiveBasePriceAsync(variant.Product));
            }

            // ===================================
            // CreateVariantAsync
            // ===================================
            public async Task<ProductVariantDto> CreateVariantAsync(Guid productId, CreateProductVariantDto dto)
            {
                var product = await _context.Products
                    .FirstOrDefaultAsync(p => p.Id == productId);
                if (product == null)
                    throw new Exception("المنتج غير موجود");

                if (!dto.AttributeValueIds.Any())
                    throw new Exception("يجب تحديد خاصية واحدة على الأقل للمتغير");

                var requestedIds = dto.AttributeValueIds.ToHashSet();
                if (requestedIds.Count != dto.AttributeValueIds.Count)
                    throw new Exception("لا يمكن تكرار نفس القيمة في المتغير");

                // التحقق من وجود كل القيم
                var attributeValues = await _context.ProductAttributeValues
                    .Include(av => av.Attribute)
                    .Where(av => requestedIds.Contains(av.Id) && av.Attribute.ProductId == productId)
                    .ToListAsync();

                if (attributeValues.Count != requestedIds.Count)
                    throw new Exception("بعض قيم الخصائص غير موجودة أو لا تنتمي لهذا المنتج");

                // قيمة واحدة فقط من كل خاصية (لا S و M معاً)
                if (attributeValues.GroupBy(av => av.AttributeId).Any(g => g.Count() > 1))
                    throw new Exception("لا يمكن اختيار أكثر من قيمة لنفس الخاصية في المتغير");

                // قيمة لكل خاصية — وإلا لا يستطيع الزبون الوصول للمتغير من صفحة المنتج
                var attributeCount = await _context.ProductAttributes.CountAsync(a => a.ProductId == productId);
                if (attributeValues.Count != attributeCount)
                    throw new Exception("يجب اختيار قيمة لكل خاصية من خصائص المنتج");

                // نفس التركيبة لا تتكرر في متغيرين
                var existingCombinations = (await _context.ProductVariantAttributeValues
                        .Where(x => x.Variant.ProductId == productId)
                        .Select(x => new { x.VariantId, x.AttributeValueId })
                        .ToListAsync())
                    .GroupBy(x => x.VariantId)
                    .Select(g => g.Select(x => x.AttributeValueId).ToHashSet());
                if (existingCombinations.Any(combination => combination.SetEquals(requestedIds)))
                    throw new Exception("يوجد متغير بنفس هذه الخيارات مسبقاً");

                EnsureNonNegativePrice(product.Price, dto.PriceAdjustment);

                var variant = new ProductVariant
                {
                    ProductId = productId,
                    Sku = dto.Sku,
                    PriceAdjustment = dto.PriceAdjustment,
                    StockQuantity = dto.StockQuantity,
                    IsAvailable = dto.IsAvailable,
                    ImageUrl = dto.ImageUrl,
                    DisplayOrder = dto.DisplayOrder,
                    AttributeValues = dto.AttributeValueIds.Select(avId => new ProductVariantAttributeValue
                    {
                        AttributeValueId = avId
                    }).ToList()
                };

                await _context.ProductVariants.AddAsync(variant);
                await _context.SaveChangesAsync();

                return await GetVariantByIdAsync(variant.Id);
            }

            // ===================================
            // UpdateVariantAsync
            // ===================================
            public async Task<ProductVariantDto> UpdateVariantAsync(Guid variantId, UpdateProductVariantDto dto)
            {
                var variant = await _context.ProductVariants
                    .Include(v => v.Product)
                    .FirstOrDefaultAsync(v => v.Id == variantId);

                if (variant == null)
                    throw new Exception("المتغير غير موجود");

                var previousStock = variant.StockQuantity;

                if (dto.Sku != null) variant.Sku = dto.Sku;
                if (dto.PriceAdjustment != null)
                {
                    EnsureNonNegativePrice(variant.Product.Price, dto.PriceAdjustment.Value);
                    variant.PriceAdjustment = dto.PriceAdjustment.Value;
                }
                if (dto.StockQuantity != null) variant.StockQuantity = dto.StockQuantity.Value;
                if (dto.IsAvailable != null) variant.IsAvailable = dto.IsAvailable.Value;
                if (dto.ImageUrl != null) variant.ImageUrl = dto.ImageUrl;
                if (dto.DisplayOrder != null) variant.DisplayOrder = dto.DisplayOrder.Value;

                variant.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                // تنبيه نقص مخزون المتغير (نفس قاعدة المنتج)
                await _inventoryService.NotifyLowStockAsync(new[]
                {
                    new StockChange(variant.ProductId, variant.Id, previousStock, variant.StockQuantity)
                });

                return await GetVariantByIdAsync(variantId);
            }

            // ===================================
            // DeleteVariantAsync
            // ===================================
            public async Task<bool> DeleteVariantAsync(Guid variantId)
            {
                var variant = await _context.ProductVariants
                    .Include(v => v.AttributeValues)
                    .FirstOrDefaultAsync(v => v.Id == variantId);

                if (variant == null)
                    return false;

                // المتغير في طلبات أو مرتجعات سابقة لا يُحذف (السجل يحتاجه) — يُخفى بدلاً من ذلك
                if (await _context.SubOrderItems.AnyAsync(i => i.VariantId == variantId) ||
                    await _context.ReturnItems.AnyAsync(i => i.VariantId == variantId))
                    throw new Exception("لا يمكن حذف هذا المتغير لأنه موجود في طلبات سابقة — اجعله غير متوفر بدلاً من ذلك");

                // إزالته من سلال الزبائن قبل الحذف
                _context.CartItems.RemoveRange(
                    await _context.CartItems.Where(c => c.VariantId == variantId).ToListAsync());

                _context.ProductVariants.Remove(variant);
                await _context.SaveChangesAsync();
                return true;
            }

            // ===================================
            // Private Helpers
            // ===================================

            private static void EnsureNonNegativePrice(decimal productPrice, decimal priceAdjustment)
            {
                if (productPrice + priceAdjustment < 0)
                    throw new Exception("فرق السعر يجعل سعر المتغير سالباً");
            }

            // سعر المنتج بعد العرض الفعّال — نفس الأساس الذي تحسب عليه السلة والطلب سعر المتغير
            private Task<decimal> GetEffectiveBasePriceAsync(Product product) =>
                _promotionService.CalculateFinalPriceAsync(
                    product.Id, product.CategoryId ?? Guid.Empty, product.VendorId, product.Price);

            private async Task<ProductAttributeDto> GetAttributeWithValuesAsync(Guid attributeId)
            {
                var attribute = await _context.ProductAttributes
                    .Include(a => a.Values)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(a => a.Id == attributeId);

                return MapAttributeToDto(attribute!);
            }

            private static ProductAttributeDto MapAttributeToDto(ProductAttribute a) => new()
            {
                Id = a.Id,
                Name = a.Name,
                NameAr = a.NameAr,
                DisplayOrder = a.DisplayOrder,
                Values = a.Values?.OrderBy(v => v.DisplayOrder)
                    .Select(MapValueToDto).ToList() ?? new()
            };

            private static ProductAttributeValueDto MapValueToDto(ProductAttributeValue v) => new()
            {
                Id = v.Id,
                Value = v.Value,
                ValueAr = v.ValueAr,
                DisplayOrder = v.DisplayOrder
            };

            private static ProductVariantDto MapVariantToDto(ProductVariant v, decimal basePrice) => new()
            {
                Id = v.Id,
                ProductId = v.ProductId,
                Sku = v.Sku,
                BasePrice = basePrice,
                PriceAdjustment = v.PriceAdjustment,
                FinalPrice = basePrice + v.PriceAdjustment,
                StockQuantity = v.StockQuantity,
                IsAvailable = v.IsAvailable,
                ImageUrl = v.ImageUrl,
                DisplayOrder = v.DisplayOrder,
                CreatedAt = v.CreatedAt,
                Attributes = v.AttributeValues?.Select(av => new VariantAttributeValueDto
                {
                    AttributeId = av.AttributeValue?.Attribute?.Id ?? Guid.Empty,
                    AttributeName = av.AttributeValue?.Attribute?.Name ?? string.Empty,
                    AttributeNameAr = av.AttributeValue?.Attribute?.NameAr,
                    ValueId = av.AttributeValueId,
                    Value = av.AttributeValue?.Value ?? string.Empty,
                    ValueAr = av.AttributeValue?.ValueAr
                }).ToList() ?? new()
            };
       }
   
}
