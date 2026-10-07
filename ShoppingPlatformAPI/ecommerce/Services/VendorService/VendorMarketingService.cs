using ecommerce.Core.Constants;
using ecommerce.Core.DTO.CouponDto;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services
{
    // عروض المتجر وكوبوناته من لوحة التاجر:
    // العرض يخص منتجاً من منتجاته أو متجره كله، والكوبون يُحسب على حصة متجره من السلة ويتحمّله المتجر
    public interface IVendorMarketingService
    {
        Task<List<VendorPromotionDto>> GetPromotionsAsync(Guid vendorId);
        Task<VendorPromotionDto> CreatePromotionAsync(Guid vendorId, SaveVendorPromotionDto dto);
        Task<VendorPromotionDto> UpdatePromotionAsync(Guid vendorId, Guid id, SaveVendorPromotionDto dto);
        Task DeletePromotionAsync(Guid vendorId, Guid id);

        Task<List<CouponDto>> GetCouponsAsync(Guid vendorId);
        Task<CouponDto> CreateCouponAsync(Guid vendorId, CreateCouponDto dto);
        Task<CouponDto> UpdateCouponAsync(Guid vendorId, Guid id, UpdateCouponDto dto);
        Task DeleteCouponAsync(Guid vendorId, Guid id);
    }

    public class VendorPromotionDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = "";
        public string TargetType { get; set; } = "";       // product | vendor
        public Guid? TargetId { get; set; }
        public string? TargetName { get; set; }            // اسم المنتج، أو «كل منتجات المتجر»
        public string DiscountType { get; set; } = "";
        public decimal DiscountValue { get; set; }
        public decimal? MaxDiscountAmount { get; set; }
        public bool IsActive { get; set; }
        public DateTime? StartsAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public bool IsOwn { get; set; }                    // false = عرض من المنصة (للعرض فقط)
        public bool IsRunning { get; set; }                // فعّال الآن
    }

    public class SaveVendorPromotionDto
    {
        public string Name { get; set; } = "";
        public string TargetType { get; set; } = PromotionTargetType.VENDOR;
        public Guid? ProductId { get; set; }
        public string DiscountType { get; set; } = Core.Constants.DiscountType.PERCENTAGE;
        public decimal DiscountValue { get; set; }
        public decimal? MaxDiscountAmount { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime? StartsAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }

    public class VendorMarketingService : IVendorMarketingService
    {
        private readonly AppDbContext _context;
        private readonly ICouponService _coupons;

        public VendorMarketingService(AppDbContext context, ICouponService coupons)
        {
            _context = context;
            _coupons = coupons;
        }

        // ===================================
        // العروض
        // ===================================
        public async Task<List<VendorPromotionDto>> GetPromotionsAsync(Guid vendorId)
        {
            var productIds = _context.Products.Where(p => p.VendorId == vendorId).Select(p => p.Id);
            // عروض المتجر نفسه + عروض المنصة التي تمس متجره أو منتجاته
            var promotions = await _context.Promotions.AsNoTracking()
                .Where(p => p.OwnerVendorId == vendorId
                    || (p.TargetType == PromotionTargetType.VENDOR && p.TargetId == vendorId)
                    || (p.TargetType == PromotionTargetType.PRODUCT && productIds.Contains(p.TargetId!.Value)))
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            var targetIds = promotions.Where(p => p.TargetType == PromotionTargetType.PRODUCT && p.TargetId != null).Select(p => p.TargetId!.Value).ToList();
            var names = await _context.Products.AsNoTracking().Where(p => targetIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.NameAr ?? p.Name);
            var now = DateTime.UtcNow;
            return promotions.Select(p => Map(p, vendorId, names, now)).ToList();
        }

        public async Task<VendorPromotionDto> CreatePromotionAsync(Guid vendorId, SaveVendorPromotionDto dto)
        {
            var promotion = new Promotion { OwnerVendorId = vendorId };
            await ApplyAsync(vendorId, promotion, dto);
            _context.Promotions.Add(promotion);
            await _context.SaveChangesAsync();
            return await GetPromotionDtoAsync(vendorId, promotion);
        }

        public async Task<VendorPromotionDto> UpdatePromotionAsync(Guid vendorId, Guid id, SaveVendorPromotionDto dto)
        {
            var promotion = await OwnPromotionAsync(vendorId, id);
            await ApplyAsync(vendorId, promotion, dto);
            promotion.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return await GetPromotionDtoAsync(vendorId, promotion);
        }

        public async Task DeletePromotionAsync(Guid vendorId, Guid id)
        {
            _context.Promotions.Remove(await OwnPromotionAsync(vendorId, id));
            await _context.SaveChangesAsync();
        }

        private async Task<Promotion> OwnPromotionAsync(Guid vendorId, Guid id) =>
            await _context.Promotions.FirstOrDefaultAsync(p => p.Id == id && p.OwnerVendorId == vendorId)
            ?? throw new NotFoundException("العرض غير موجود أو ليس من عروض متجرك");

        private async Task ApplyAsync(Guid vendorId, Promotion promotion, SaveVendorPromotionDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                throw new BusinessRuleException("اكتب اسماً للعرض");
            if (!Core.Constants.DiscountType.All.Contains(dto.DiscountType))
                throw new BusinessRuleException("نوع الخصم يجب أن يكون نسبة أو مبلغاً ثابتاً");
            if (dto.DiscountValue <= 0)
                throw new BusinessRuleException("قيمة الخصم يجب أن تكون أكبر من صفر");
            if (dto.DiscountType == Core.Constants.DiscountType.PERCENTAGE && dto.DiscountValue >= 100)
                throw new BusinessRuleException("نسبة الخصم يجب أن تكون أقل من 100%");
            if (dto.StartsAt.HasValue && dto.ExpiresAt.HasValue && dto.StartsAt >= dto.ExpiresAt)
                throw new BusinessRuleException("تاريخ البداية يجب أن يكون قبل تاريخ الانتهاء");

            if (dto.TargetType == PromotionTargetType.PRODUCT)
            {
                var owned = dto.ProductId is Guid pid
                    && await _context.Products.AnyAsync(p => p.Id == pid && p.VendorId == vendorId && !p.IsDeleted);
                if (!owned) throw new BusinessRuleException("اختر منتجاً من منتجات متجرك");
                promotion.TargetId = dto.ProductId;
            }
            else if (dto.TargetType == PromotionTargetType.VENDOR)
                promotion.TargetId = vendorId;
            else
                throw new BusinessRuleException("العرض يكون على منتج من منتجاتك أو على متجرك كله");

            promotion.TargetType = dto.TargetType;
            promotion.Name = dto.Name.Trim();
            promotion.NameAr = dto.Name.Trim();
            promotion.DiscountType = dto.DiscountType;
            promotion.DiscountValue = dto.DiscountValue;
            promotion.MaxDiscountAmount = dto.DiscountType == Core.Constants.DiscountType.PERCENTAGE ? dto.MaxDiscountAmount : null;
            promotion.IsActive = dto.IsActive;
            promotion.StartsAt = dto.StartsAt;
            promotion.ExpiresAt = dto.ExpiresAt;
        }

        private async Task<VendorPromotionDto> GetPromotionDtoAsync(Guid vendorId, Promotion p)
        {
            var names = p.TargetType == PromotionTargetType.PRODUCT && p.TargetId is Guid id
                ? await _context.Products.AsNoTracking().Where(x => x.Id == id).ToDictionaryAsync(x => x.Id, x => x.NameAr ?? x.Name)
                : new Dictionary<Guid, string>();
            return Map(p, vendorId, names, DateTime.UtcNow);
        }

        private static VendorPromotionDto Map(Promotion p, Guid vendorId, Dictionary<Guid, string> productNames, DateTime now) => new()
        {
            Id = p.Id,
            Name = p.NameAr ?? p.Name,
            TargetType = p.TargetType,
            TargetId = p.TargetId,
            TargetName = p.TargetType == PromotionTargetType.VENDOR ? "كل منتجات المتجر"
                : p.TargetId is Guid id && productNames.TryGetValue(id, out var name) ? name : null,
            DiscountType = p.DiscountType,
            DiscountValue = p.DiscountValue,
            MaxDiscountAmount = p.MaxDiscountAmount,
            IsActive = p.IsActive,
            StartsAt = p.StartsAt,
            ExpiresAt = p.ExpiresAt,
            IsOwn = p.OwnerVendorId == vendorId,
            IsRunning = p.IsActive && (p.StartsAt == null || p.StartsAt <= now) && (p.ExpiresAt == null || p.ExpiresAt >= now),
        };

        // ===================================
        // الكوبونات — كل كوبون مربوط بالمتجر يتحمّله المتجر في الحسابات
        // ===================================
        public async Task<List<CouponDto>> GetCouponsAsync(Guid vendorId)
        {
            var ids = await _context.Coupons.AsNoTracking().Where(c => c.VendorId == vendorId)
                .OrderByDescending(c => c.CreatedAt).Select(c => c.Id).ToListAsync();
            var list = new List<CouponDto>();
            foreach (var id in ids) list.Add(await _coupons.GetByIdAsync(id));
            return list;
        }

        public Task<CouponDto> CreateCouponAsync(Guid vendorId, CreateCouponDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Code) || dto.Code.Trim().Length < 3)
                throw new BusinessRuleException("كود الكوبون 3 أحرف على الأقل");
            if (dto.DiscountValue <= 0)
                throw new BusinessRuleException("قيمة الخصم يجب أن تكون أكبر من صفر");
            dto.VendorId = vendorId;
            dto.CategoryId = null;
            return _coupons.CreateAsync(dto);
        }

        public async Task<CouponDto> UpdateCouponAsync(Guid vendorId, Guid id, UpdateCouponDto dto)
        {
            await EnsureOwnCouponAsync(vendorId, id);
            return await _coupons.UpdateAsync(id, dto);
        }

        public async Task DeleteCouponAsync(Guid vendorId, Guid id)
        {
            await EnsureOwnCouponAsync(vendorId, id);
            // الكوبون المستخدم يُوقف بدل حذفه — سجل الاستخدام والحسابات تشير إليه
            if (await _context.CouponUsages.AnyAsync(u => u.CouponId == id))
                await _coupons.UpdateAsync(id, new UpdateCouponDto { IsActive = false });
            else
                await _coupons.DeleteAsync(id);
        }

        private async Task EnsureOwnCouponAsync(Guid vendorId, Guid id)
        {
            if (!await _context.Coupons.AnyAsync(c => c.Id == id && c.VendorId == vendorId))
                throw new NotFoundException("الكوبون غير موجود أو ليس من كوبونات متجرك");
        }
    }
}
