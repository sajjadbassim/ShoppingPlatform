using ecommerce.Core.Exceptions;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ecommerce.Services.VendorAccessService
{
    // التحقق من أن المستخدم الحالي يملك المتجر (أو المنتج/الصورة/المتغير التابع له) قبل أي تعديل.
    // الإدارة (ADMIN) والعمليات (OPS) مسموح لهم بكل المتاجر؛ صاحب المتجر (VENDOR) بمتجره فقط؛ غيرهم ممنوع.
    // يرمي NotFoundException إن لم يوجد العنصر، و ForbiddenException إن لم يكن من حق المستخدم.
    public interface IVendorAccessService
    {
        Task EnsureCanManageVendorAsync(Guid vendorId, CancellationToken ct = default);
        Task EnsureCanManageProductAsync(Guid productId, CancellationToken ct = default);
        Task EnsureCanManageProductImageAsync(Guid imageId, CancellationToken ct = default);
        Task EnsureCanManageAttributeAsync(Guid productId, Guid attributeId, CancellationToken ct = default);
        Task EnsureCanManageAttributeValueAsync(Guid productId, Guid attributeId, Guid valueId, CancellationToken ct = default);
        Task EnsureCanManageVariantAsync(Guid productId, Guid variantId, CancellationToken ct = default);
    }

    public class VendorAccessService : IVendorAccessService
    {
        private const string Denied = "لا تملك صلاحية على هذا المتجر";

        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public VendorAccessService(AppDbContext context, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }

        private ClaimsPrincipal User =>
            _httpContextAccessor.HttpContext?.User ?? throw new UnauthorizedException("يجب تسجيل الدخول");

        private bool IsStaff => User.IsInRole("ADMIN") || User.IsInRole("OPS");

        private Guid CurrentUserId =>
            Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
                ? id
                : throw new UnauthorizedException("يجب تسجيل الدخول");

        public async Task EnsureCanManageVendorAsync(Guid vendorId, CancellationToken ct = default)
        {
            var ownerId = await _context.Vendors
                .Where(v => v.Id == vendorId)
                .Select(v => new { v.OwnerId })
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException("المتجر غير موجود");

            EnsureOwner(ownerId.OwnerId);
        }

        public async Task EnsureCanManageProductAsync(Guid productId, CancellationToken ct = default)
        {
            var product = await _context.Products
                .Where(p => p.Id == productId)
                .Select(p => new { p.Vendor.OwnerId })
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException("المنتج غير موجود");

            EnsureOwner(product.OwnerId);
        }

        public async Task EnsureCanManageProductImageAsync(Guid imageId, CancellationToken ct = default)
        {
            var image = await _context.ProductImages
                .Where(i => i.Id == imageId)
                .Select(i => new { i.Product.Vendor.OwnerId })
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException("الصورة غير موجودة");

            EnsureOwner(image.OwnerId);
        }

        // الخاصية/القيمة/المتغير يجب أن تتبع المنتج المذكور في الرابط — وإلا يمكن تمرير منتج مملوك مع عنصر من منتج آخر
        public async Task EnsureCanManageAttributeAsync(Guid productId, Guid attributeId, CancellationToken ct = default)
        {
            await EnsureCanManageProductAsync(productId, ct);
            if (!await _context.ProductAttributes.AnyAsync(a => a.Id == attributeId && a.ProductId == productId, ct))
                throw new NotFoundException("الخاصية غير موجودة");
        }

        public async Task EnsureCanManageAttributeValueAsync(Guid productId, Guid attributeId, Guid valueId, CancellationToken ct = default)
        {
            await EnsureCanManageAttributeAsync(productId, attributeId, ct);
            if (!await _context.ProductAttributeValues.AnyAsync(v => v.Id == valueId && v.AttributeId == attributeId, ct))
                throw new NotFoundException("القيمة غير موجودة");
        }

        public async Task EnsureCanManageVariantAsync(Guid productId, Guid variantId, CancellationToken ct = default)
        {
            await EnsureCanManageProductAsync(productId, ct);
            if (!await _context.ProductVariants.AnyAsync(v => v.Id == variantId && v.ProductId == productId, ct))
                throw new NotFoundException("المتغير غير موجود");
        }

        private void EnsureOwner(Guid? ownerId)
        {
            if (IsStaff) return;
            if (User.IsInRole("VENDOR") && ownerId.HasValue && ownerId.Value == CurrentUserId) return;
            throw new ForbiddenException(Denied);
        }
    }
}
