using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Promotion;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using Microsoft.EntityFrameworkCore;
using ecommerce.Core.Exceptions;

namespace ecommerce.Services
{
    public class PromotionService : IPromotionService
    {
        private readonly IPromotionRepository _promotionRepository;
        private readonly AppDbContext _context;

        public PromotionService(
            IPromotionRepository promotionRepository,
            AppDbContext context)
        {
            _promotionRepository = promotionRepository;
            _context = context;
        }

        // ===================================
        // GetActiveAsync
        // ===================================
        public async Task<IEnumerable<PromotionDto>> GetActiveAsync()
        {
            var promotions = await _promotionRepository.GetActivePromotionsAsync();

            // ✅ تسلسلياً وليس Task.WhenAll — DbContext لا يدعم عمليات متزامنة على نفس الـ instance
            var dtos = new List<PromotionDto>();
            foreach (var promotion in promotions)
                dtos.Add(await MapToDtoAsync(promotion));

            return dtos;
        }

        // ===================================
        // GetProductPriceAsync
        // ===================================
        public async Task<ProductPromotionDto> GetProductPriceAsync(Guid productId)
        {
            var product = await _context.Products
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == productId);

            if (product == null)
                throw new NotFoundException("المنتج غير موجود");

            var categoryId = product.CategoryId ?? Guid.Empty;

            var promotion = await _promotionRepository.GetBestPromotionForProductAsync(
                productId, categoryId, product.VendorId);

            var originalPrice = product.OriginalPrice ?? product.Price;
            var finalPrice = product.Price;
            decimal discountAmount = 0;
            decimal discountPercentage = 0;

            if (promotion != null)
            {
                // الخصم على سعر البيع (كما في السلة)، والتوفير يُحسب مقابل السعر المشطوب
                (finalPrice, _) = PromotionPricing.CalculateDiscount(product.Price, promotion);
                discountAmount = originalPrice - finalPrice;
                discountPercentage = originalPrice > 0
                    ? Math.Round(discountAmount / originalPrice * 100, 1)
                    : 0;
            }

            return new ProductPromotionDto
            {
                ProductId = productId,
                OriginalPrice = originalPrice,
                FinalPrice = finalPrice,
                DiscountAmount = discountAmount,
                DiscountPercentage = discountPercentage,
                HasPromotion = promotion != null,
                PromotionName = promotion?.Name,
                PromotionNameAr = promotion?.NameAr,
                PromotionExpiresAt = promotion?.ExpiresAt
            };
        }

        // ===================================
        // CalculateFinalPriceAsync - Helper للـ ProductService
        // ===================================
        public async Task<decimal> CalculateFinalPriceAsync(
            Guid productId, Guid categoryId, Guid vendorId, decimal originalPrice)
        {
            var promotion = await _promotionRepository.GetBestPromotionForProductAsync(
                productId, categoryId, vendorId);

            if (promotion == null)
                return originalPrice;

            var (finalPrice, _) = PromotionPricing.CalculateDiscount(originalPrice, promotion);
            return finalPrice;
        }

        // ===================================
        // CalculateFinalPricesAsync — العروض الفعّالة تُحمَّل مرة واحدة بدل استعلام لكل بند
        // ===================================
        public async Task<IReadOnlyDictionary<Guid, decimal>> CalculateFinalPricesAsync(IEnumerable<PriceQuery> items)
        {
            var products = items.DistinctBy(i => i.Key ?? i.ProductId).ToList();
            if (products.Count == 0)
                return new Dictionary<Guid, decimal>();

            var activePromotions = (await _promotionRepository.GetActivePromotionsAsync()).ToList();
            return products.ToDictionary(i => i.Key ?? i.ProductId, i =>
            {
                var promotion = PromotionPricing.SelectBest(activePromotions, i.ProductId, i.CategoryId, i.VendorId);
                return promotion == null ? i.Price : PromotionPricing.CalculateDiscount(i.Price, promotion).FinalPrice;
            });
        }

        // ===================================
        // GetByIdAsync
        // ===================================
        public async Task<PromotionDto> GetByIdAsync(Guid id)
        {
            var promotion = await _promotionRepository.GetByIdAsync(id);
            if (promotion == null)
                throw new NotFoundException("العرض غير موجود");

            return await MapToDtoAsync(promotion);
        }

        // ===================================
        // GetAllAsync
        // ===================================
        public async Task<IEnumerable<PromotionDto>> GetAllAsync()
        {
            var promotions = await _promotionRepository.GetAllAsync();

            // ✅ تسلسلياً وليس Task.WhenAll — DbContext لا يدعم عمليات متزامنة على نفس الـ instance
            var dtos = new List<PromotionDto>();
            foreach (var promotion in promotions)
                dtos.Add(await MapToDtoAsync(promotion));

            return dtos;
        }

        // ===================================
        // GetPagedAsync
        // ===================================
        public async Task<(IEnumerable<PromotionDto> Promotions, int TotalCount)> GetPagedAsync(
            bool? isActive = null,
            string? targetType = null,
            int pageNumber = 1,
            int pageSize = 20)
        {
            var (promotions, totalCount) = await _promotionRepository.GetPagedAsync(
                isActive, targetType, pageNumber, pageSize);

            // ✅ تسلسلياً وليس Task.WhenAll — DbContext لا يدعم عمليات متزامنة على نفس الـ instance
            var dtos = new List<PromotionDto>();
            foreach (var promotion in promotions)
                dtos.Add(await MapToDtoAsync(promotion));

            return (dtos, totalCount);
        }

        // ===================================
        // CreateAsync
        // ===================================
        public async Task<PromotionDto> CreateAsync(CreatePromotionDto dto)
        {
            // Validation
            if (!PromotionTargetType.All.Contains(dto.TargetType))
                throw new BusinessRuleException("نوع الهدف غير صالح");

            if (!DiscountType.All.Contains(dto.DiscountType))
                throw new BusinessRuleException("نوع الخصم يجب أن يكون percentage أو fixed");

            if (dto.TargetType != PromotionTargetType.ALL && dto.TargetId == null)
                throw new BusinessRuleException("يجب تحديد الهدف (منتج / تصنيف / بائع)");

            if (dto.DiscountType == DiscountType.PERCENTAGE && dto.DiscountValue > 100)
                throw new BusinessRuleException("نسبة الخصم لا يمكن أن تتجاوز 100%");

            if (dto.StartsAt.HasValue && dto.ExpiresAt.HasValue && dto.StartsAt >= dto.ExpiresAt)
                throw new BusinessRuleException("تاريخ البداية يجب أن يكون قبل تاريخ الانتهاء");

            var promotion = new Promotion
            {
                Name = dto.Name,
                NameAr = dto.NameAr,
                Description = dto.Description,
                TargetType = dto.TargetType,
                TargetId = dto.TargetType == PromotionTargetType.ALL ? null : dto.TargetId,
                DiscountType = dto.DiscountType,
                DiscountValue = dto.DiscountValue,
                MaxDiscountAmount = dto.MaxDiscountAmount,
                IsActive = dto.IsActive,
                StartsAt = dto.StartsAt,
                ExpiresAt = dto.ExpiresAt
            };

            var created = await _promotionRepository.CreateAsync(promotion);
            return await GetByIdAsync(created.Id);
        }

        // ===================================
        // UpdateAsync
        // ===================================
        public async Task<PromotionDto> UpdateAsync(Guid id, UpdatePromotionDto dto)
        {
            var promotion = await _promotionRepository.GetByIdAsync(id);
            if (promotion == null)
                throw new NotFoundException("العرض غير موجود");

            if (dto.Name != null) promotion.Name = dto.Name;
            if (dto.NameAr != null) promotion.NameAr = dto.NameAr;
            if (dto.Description != null) promotion.Description = dto.Description;
            if (dto.DiscountValue.HasValue) promotion.DiscountValue = dto.DiscountValue.Value;
            if (dto.MaxDiscountAmount.HasValue) promotion.MaxDiscountAmount = dto.MaxDiscountAmount;
            if (dto.IsActive.HasValue) promotion.IsActive = dto.IsActive.Value;
            if (dto.StartsAt.HasValue) promotion.StartsAt = dto.StartsAt;
            if (dto.ExpiresAt.HasValue) promotion.ExpiresAt = dto.ExpiresAt;

            if (promotion.StartsAt.HasValue && promotion.ExpiresAt.HasValue &&
                promotion.StartsAt >= promotion.ExpiresAt)
                throw new BusinessRuleException("تاريخ البداية يجب أن يكون قبل تاريخ الانتهاء");

            await _promotionRepository.UpdateAsync(promotion);
            return await GetByIdAsync(id);
        }

        // ===================================
        // DeleteAsync
        // ===================================
        public async Task<bool> DeleteAsync(Guid id)
        {
            var promotion = await _promotionRepository.GetByIdAsync(id);
            if (promotion == null)
                throw new NotFoundException("العرض غير موجود");

            return await _promotionRepository.DeleteAsync(id);
        }

        // ===================================
        // Private Helpers
        // ===================================
        private async Task<PromotionDto> MapToDtoAsync(Promotion p)
        {
            string? targetName = null;

            if (p.TargetId.HasValue)
            {
                targetName = p.TargetType switch
                {
                    PromotionTargetType.PRODUCT => (await _context.Products.AsNoTracking()
                        .FirstOrDefaultAsync(x => x.Id == p.TargetId))?.Name,
                    PromotionTargetType.CATEGORY => (await _context.Categories.AsNoTracking()
                        .FirstOrDefaultAsync(x => x.Id == p.TargetId))?.Name,
                    PromotionTargetType.VENDOR => (await _context.Vendors.AsNoTracking()
                        .FirstOrDefaultAsync(x => x.Id == p.TargetId))?.Name,
                    _ => null
                };
            }

            return new PromotionDto
            {
                Id = p.Id,
                Name = p.Name,
                NameAr = p.NameAr,
                Description = p.Description,
                TargetType = p.TargetType,
                TargetId = p.TargetId,
                TargetName = targetName,
                DiscountType = p.DiscountType,
                DiscountValue = p.DiscountValue,
                MaxDiscountAmount = p.MaxDiscountAmount,
                IsActive = p.IsActive,
                StartsAt = p.StartsAt,
                ExpiresAt = p.ExpiresAt,
                CreatedAt = p.CreatedAt
            };
        }
    }
}