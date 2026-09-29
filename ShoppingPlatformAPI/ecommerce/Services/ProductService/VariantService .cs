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

            public VariantService(AppDbContext context, IInventoryService inventoryService)
            {
                _context = context;
                _inventoryService = inventoryService;
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

                return variants.Select(v => MapVariantToDto(v, product.Price)).ToList();
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

                return MapVariantToDto(variant, variant.Product.Price);
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

                // التحقق من وجود كل القيم
                var attributeValues = await _context.ProductAttributeValues
                    .Include(av => av.Attribute)
                    .Where(av => dto.AttributeValueIds.Contains(av.Id) && av.Attribute.ProductId == productId)
                    .ToListAsync();

                if (attributeValues.Count != dto.AttributeValueIds.Count)
                    throw new Exception("بعض قيم الخصائص غير موجودة أو لا تنتمي لهذا المنتج");

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
                if (dto.PriceAdjustment != null) variant.PriceAdjustment = dto.PriceAdjustment.Value;
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

                _context.ProductVariants.Remove(variant);
                await _context.SaveChangesAsync();
                return true;
            }

            // ===================================
            // Private Helpers
            // ===================================
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
