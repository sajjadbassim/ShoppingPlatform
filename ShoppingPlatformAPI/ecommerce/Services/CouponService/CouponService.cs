using ecommerce.Core.Constants;
using ecommerce.Core.DTO.CouponDto;
using ecommerce.Core.Models;
using ecommerce.Repositories;

namespace ecommerce.Services
{
    public class CouponService : ICouponService
    {
        private readonly ICouponRepository _couponRepository;

        public CouponService(ICouponRepository couponRepository)
        {
            _couponRepository = couponRepository;
        }

        // ===================================
        // ValidateAsync - التحقق من الكوبون
        // ===================================
        public async Task<CouponValidationResultDto> ValidateAsync(Guid userId, ValidateCouponDto dto)
        {
            var coupon = await _couponRepository.GetByCodeAsync(dto.Code);

            // ===================================
            // 1. هل الكوبون موجود؟
            // ===================================
            if (coupon == null)
                return InvalidResult("كود الكوبون غير صحيح");

            // ===================================
            // 2. هل الكوبون مفعّل؟
            // ===================================
            if (!coupon.IsActive)
                return InvalidResult("هذا الكوبون غير مفعّل");

            // ===================================
            // 3. هل انتهت صلاحيته؟
            // ===================================
            if (coupon.ExpiresAt.HasValue && coupon.ExpiresAt.Value < DateTime.UtcNow)
                return InvalidResult("انتهت صلاحية هذا الكوبون");

            // ===================================
            // 4. هل بدأ بعد؟
            // ===================================
            if (coupon.StartsAt.HasValue && coupon.StartsAt.Value > DateTime.UtcNow)
                return InvalidResult("هذا الكوبون لم يبدأ بعد");

            // ===================================
            // 5. هل تجاوز الحد الكلي للاستخدام؟
            // ===================================
            if (coupon.UsageLimit.HasValue && coupon.UsageCount >= coupon.UsageLimit.Value)
                return InvalidResult("تم استنفاد استخدامات هذا الكوبون");

            // ===================================
            // 6. هل تجاوز المستخدم حده الشخصي؟
            // ===================================
            var userUsageCount = await _couponRepository.GetUserUsageCountAsync(coupon.Id, userId);
            if (userUsageCount >= coupon.UserUsageLimit)
                return InvalidResult("لقد استخدمت هذا الكوبون العدد المسموح به");

            // ===================================
            // 7. هل الطلب يبلغ الحد الأدنى؟
            // ===================================
            if (dto.OrderAmount < coupon.MinOrderAmount)
                return InvalidResult($"الحد الأدنى للطلب لاستخدام هذا الكوبون هو {coupon.MinOrderAmount} دينار");

            // ===================================
            // 8. حساب مبلغ الخصم
            // ===================================
            decimal discountAmount;

            if (coupon.DiscountType == DiscountType.PERCENTAGE)
            {
                discountAmount = dto.OrderAmount * (coupon.DiscountValue / 100);

                // تطبيق السقف الأقصى إذا وجد
                if (coupon.MaxDiscountAmount.HasValue)
                    discountAmount = Math.Min(discountAmount, coupon.MaxDiscountAmount.Value);
            }
            else // FIXED
            {
                discountAmount = Math.Min(coupon.DiscountValue, dto.OrderAmount);
            }

            discountAmount = Math.Round(discountAmount, 2);
            var finalAmount = Math.Round(dto.OrderAmount - discountAmount, 2);

            return new CouponValidationResultDto
            {
                IsValid = true,
                Code = coupon.Code,
                DiscountType = coupon.DiscountType,
                DiscountValue = coupon.DiscountValue,
                DiscountAmount = discountAmount,
                FinalAmount = finalAmount
            };
        }

        // ===================================
        // GetByIdAsync
        // ===================================
        public async Task<CouponDto> GetByIdAsync(Guid id)
        {
            var coupon = await _couponRepository.GetByIdAsync(id);
            if (coupon == null)
                throw new Exception("الكوبون غير موجود");

            return MapToDto(coupon);
        }

        // ===================================
        // GetAllAsync
        // ===================================
        public async Task<IEnumerable<CouponDto>> GetAllAsync()
        {
            var coupons = await _couponRepository.GetAllAsync();
            return coupons.Select(MapToDto);
        }

        // ===================================
        // GetPagedAsync
        // ===================================
        public async Task<(IEnumerable<CouponDto> Coupons, int TotalCount)> GetPagedAsync(
            bool? isActive = null,
            int pageNumber = 1,
            int pageSize = 20)
        {
            var (coupons, totalCount) = await _couponRepository.GetPagedAsync(isActive, pageNumber, pageSize);
            return (coupons.Select(MapToDto), totalCount);
        }

        // ===================================
        // CreateAsync
        // ===================================
        public async Task<CouponDto> CreateAsync(CreateCouponDto dto)
        {
            // التحقق من عدم تكرار الكود
            var codeExists = await _couponRepository.CodeExistsAsync(dto.Code);
            if (codeExists)
                throw new Exception($"الكود '{dto.Code}' مستخدم مسبقاً");

            if (!DiscountType.All.Contains(dto.DiscountType))
                throw new Exception("نوع الخصم يجب أن يكون percentage أو fixed");

            if (dto.DiscountType == DiscountType.PERCENTAGE && dto.DiscountValue > 100)
                throw new Exception("نسبة الخصم لا يمكن أن تتجاوز 100%");

            var coupon = new Coupon
            {
                Code = dto.Code.ToUpper().Trim(),
                Description = dto.Description,
                DiscountType = dto.DiscountType,
                DiscountValue = dto.DiscountValue,
                MinOrderAmount = dto.MinOrderAmount,
                MaxDiscountAmount = dto.MaxDiscountAmount,
                UsageLimit = dto.UsageLimit,
                UserUsageLimit = dto.UserUsageLimit,
                VendorId = dto.VendorId,
                CategoryId = dto.CategoryId,
                IsActive = dto.IsActive,
                StartsAt = dto.StartsAt,
                ExpiresAt = dto.ExpiresAt
            };

            var created = await _couponRepository.CreateAsync(coupon);
            return await GetByIdAsync(created.Id);
        }

        // ===================================
        // UpdateAsync
        // ===================================
        public async Task<CouponDto> UpdateAsync(Guid id, UpdateCouponDto dto)
        {
            var coupon = await _couponRepository.GetByIdAsync(id);
            if (coupon == null)
                throw new Exception("الكوبون غير موجود");

            if (dto.Description != null) coupon.Description = dto.Description;
            if (dto.DiscountValue.HasValue) coupon.DiscountValue = dto.DiscountValue.Value;
            if (dto.MinOrderAmount.HasValue) coupon.MinOrderAmount = dto.MinOrderAmount.Value;
            if (dto.MaxDiscountAmount.HasValue) coupon.MaxDiscountAmount = dto.MaxDiscountAmount;
            if (dto.UsageLimit.HasValue) coupon.UsageLimit = dto.UsageLimit;
            if (dto.UserUsageLimit.HasValue) coupon.UserUsageLimit = dto.UserUsageLimit.Value;
            if (dto.IsActive.HasValue) coupon.IsActive = dto.IsActive.Value;
            if (dto.StartsAt.HasValue) coupon.StartsAt = dto.StartsAt;
            if (dto.ExpiresAt.HasValue) coupon.ExpiresAt = dto.ExpiresAt;

            await _couponRepository.UpdateAsync(coupon);
            return await GetByIdAsync(id);
        }

        // ===================================
        // DeleteAsync
        // ===================================
        public async Task<bool> DeleteAsync(Guid id)
        {
            var coupon = await _couponRepository.GetByIdAsync(id);
            if (coupon == null)
                throw new Exception("الكوبون غير موجود");

            return await _couponRepository.DeleteAsync(id);
        }

        // ===================================
        // Private Helpers
        // ===================================
        private static CouponValidationResultDto InvalidResult(string errorMessage) => new()
        {
            IsValid = false,
            ErrorMessage = errorMessage
        };

        private static CouponDto MapToDto(Coupon c) => new()
        {
            Id = c.Id,
            Code = c.Code,
            Description = c.Description,
            DiscountType = c.DiscountType,
            DiscountValue = c.DiscountValue,
            MinOrderAmount = c.MinOrderAmount,
            MaxDiscountAmount = c.MaxDiscountAmount,
            UsageLimit = c.UsageLimit,
            UsageCount = c.UsageCount,
            UserUsageLimit = c.UserUsageLimit,
            VendorId = c.VendorId,
            VendorName = c.Vendor?.Name,
            CategoryId = c.CategoryId,
            CategoryName = c.Category?.Name,
            IsActive = c.IsActive,
            StartsAt = c.StartsAt,
            ExpiresAt = c.ExpiresAt,
            CreatedAt = c.CreatedAt
        };
    }
}