using ecommerce.Core.Constants;
using ecommerce.Core.DTO.CouponDto;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Core.Exceptions;

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
        // vendorSubtotals: مجموع كل متجر في السلة — كوبون المتجر (VendorId) يُحسب على حصة متجره فقط،
        // وإلا كان يخصم من الطلب كله بينما يتحمّله متجر واحد في الحسابات
        public async Task<CouponValidationResultDto> ValidateAsync(Guid userId, ValidateCouponDto dto,
            IReadOnlyDictionary<Guid, decimal>? vendorSubtotals = null)
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
            // 7. المبلغ المشمول بالكوبون: الطلب كله، أو حصة متجر الكوبون فقط
            // ===================================
            var eligibleAmount = dto.OrderAmount;
            if (coupon.VendorId is Guid couponVendor)
            {
                eligibleAmount = vendorSubtotals?.GetValueOrDefault(couponVendor) ?? 0;
                if (eligibleAmount <= 0)
                    return InvalidResult($"هذا الكوبون خاص بمتجر «{coupon.Vendor?.NameAr ?? coupon.Vendor?.Name ?? "آخر"}» — أضف من منتجاته إلى السلة");
            }

            if (eligibleAmount < coupon.MinOrderAmount)
                return InvalidResult(coupon.VendorId != null
                    ? $"الحد الأدنى لمشتريات هذا المتجر لاستخدام الكوبون هو {coupon.MinOrderAmount:N0} د.ع"
                    : $"الحد الأدنى للطلب لاستخدام هذا الكوبون هو {coupon.MinOrderAmount:N0} د.ع");

            // ===================================
            // 8. حساب مبلغ الخصم
            // ===================================
            decimal discountAmount;

            if (coupon.DiscountType == DiscountType.PERCENTAGE)
            {
                discountAmount = eligibleAmount * (coupon.DiscountValue / 100);

                // تطبيق السقف الأقصى إذا وجد
                if (coupon.MaxDiscountAmount.HasValue)
                    discountAmount = Math.Min(discountAmount, coupon.MaxDiscountAmount.Value);
            }
            else // FIXED
            {
                discountAmount = Math.Min(coupon.DiscountValue, eligibleAmount);
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
                throw new NotFoundException("الكوبون غير موجود");

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
                throw new BusinessRuleException($"الكود '{dto.Code}' مستخدم مسبقاً");

            if (!DiscountType.All.Contains(dto.DiscountType))
                throw new BusinessRuleException("نوع الخصم يجب أن يكون percentage أو fixed");

            ValidateValues(dto.DiscountType, dto.DiscountValue, dto.MinOrderAmount, dto.MaxDiscountAmount, dto.UsageLimit, 0, dto.UserUsageLimit);
            ValidateDates(dto.StartsAt, dto.ExpiresAt);

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
                throw new NotFoundException("الكوبون غير موجود");

            // نفس شروط الإنشاء — تعديل كوبون فعّال بخطأ (15 ← 150%) يجعل البضاعة مجانية
            // سقف الخصم 0 = إلغاء السقف؛ حد الاستخدام 0 = بلا حد
            var maxDiscount = dto.MaxDiscountAmount.HasValue ? (dto.MaxDiscountAmount > 0 ? dto.MaxDiscountAmount : null) : coupon.MaxDiscountAmount;
            var usageLimit = dto.UsageLimit.HasValue ? (dto.UsageLimit > 0 ? dto.UsageLimit : null) : coupon.UsageLimit;
            ValidateValues(coupon.DiscountType, dto.DiscountValue ?? coupon.DiscountValue, dto.MinOrderAmount ?? coupon.MinOrderAmount,
                maxDiscount, usageLimit, coupon.UsageCount, dto.UserUsageLimit ?? coupon.UserUsageLimit);

            if (dto.Description != null) coupon.Description = dto.Description;
            if (dto.DiscountValue.HasValue) coupon.DiscountValue = dto.DiscountValue.Value;
            if (dto.MinOrderAmount.HasValue) coupon.MinOrderAmount = dto.MinOrderAmount.Value;
            coupon.MaxDiscountAmount = maxDiscount;
            coupon.UsageLimit = usageLimit;
            if (dto.UserUsageLimit.HasValue) coupon.UserUsageLimit = dto.UserUsageLimit.Value;
            if (dto.IsActive.HasValue) coupon.IsActive = dto.IsActive.Value;
            if (dto.ExpiresAt.HasValue) ValidateDates(dto.StartsAt ?? coupon.StartsAt, dto.ExpiresAt);
            else if (dto.StartsAt.HasValue) ValidateDates(dto.StartsAt, coupon.ExpiresAt, checkPast: false);
            if (dto.StartsAt.HasValue) coupon.StartsAt = dto.StartsAt;
            if (dto.ExpiresAt.HasValue) coupon.ExpiresAt = dto.ExpiresAt;

            await _couponRepository.UpdateAsync(coupon);
            return await GetByIdAsync(id);
        }

        private static void ValidateValues(string type, decimal value, decimal minOrder, decimal? maxDiscount,
            int? usageLimit, int usageCount, int userUsageLimit)
        {
            if (value <= 0)
                throw new BusinessRuleException("قيمة الخصم يجب أن تكون أكبر من صفر");
            if (type == DiscountType.PERCENTAGE && value > 100)
                throw new BusinessRuleException("نسبة الخصم لا يمكن أن تتجاوز 100%");
            // 100% بلا سقف = البضاعة مجانية لأي سلة مهما كبرت
            if (type == DiscountType.PERCENTAGE && value >= 100 && maxDiscount is not > 0)
                throw new BusinessRuleException("خصم 100% يحتاج سقفاً للخصم — حدّد أقصى مبلغ يُخصم");
            if (minOrder < 0)
                throw new BusinessRuleException("الحد الأدنى للطلب لا يكون سالباً");
            if (maxDiscount is < 0)
                throw new BusinessRuleException("سقف الخصم لا يكون سالباً");
            if (usageLimit.HasValue && usageLimit.Value < usageCount)
                throw new BusinessRuleException($"حد الاستخدام ({usageLimit}) أقل من عدد مرات استخدامه حتى الآن ({usageCount})");
            if (userUsageLimit < 1)
                throw new BusinessRuleException("حد الاستخدام لكل زبون يجب أن يكون 1 على الأقل");
        }

        // كوبون ينتهي قبل أن يُنشأ لا يعمل أبداً — غالباً خطأ في إدخال التاريخ (لإيقاف كوبون: عطّله)
        private static void ValidateDates(DateTime? startsAt, DateTime? expiresAt, bool checkPast = true)
        {
            if (checkPast && expiresAt.HasValue && expiresAt.Value <= DateTime.UtcNow)
                throw new BusinessRuleException("تاريخ انتهاء الكوبون مضى — اختر تاريخاً قادماً، أو عطّل الكوبون بدلاً من ذلك");
            if (startsAt.HasValue && expiresAt.HasValue && startsAt.Value >= expiresAt.Value)
                throw new BusinessRuleException("تاريخ بداية الكوبون يجب أن يسبق تاريخ انتهائه");
        }

        // ===================================
        // DeleteAsync
        // ===================================
        public async Task<bool> DeleteAsync(Guid id)
        {
            var coupon = await _couponRepository.GetByIdAsync(id);
            if (coupon == null)
                throw new NotFoundException("الكوبون غير موجود");

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