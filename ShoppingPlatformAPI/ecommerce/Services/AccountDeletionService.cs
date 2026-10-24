using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services
{
    public interface IAccountDeletionService
    {
        // حذف الزبون لحسابه بنفسه (شرط متجري Apple وGoogle): إخفاء هوية + تعطيل، مع إبقاء الطلبات والفواتير للسجلات
        Task DeleteOwnAccountAsync(Guid userId, string? password);
    }

    public class AccountDeletionService : IAccountDeletionService
    {
        public const string DeletedName = "مستخدم محذوف";

        private static readonly string[] FinalOrderStatuses =
            { OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.DELIVERY_FAILED };

        private readonly AppDbContext _context;
        private readonly IAvatarService _avatars;

        public AccountDeletionService(AppDbContext context, IAvatarService avatars)
        {
            _context = context;
            _avatars = avatars;
        }

        public async Task DeleteOwnAccountAsync(Guid userId, string? password)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId)
                ?? throw new NotFoundException("المستخدم غير موجود");

            if (!user.IsActive)
                throw new BusinessRuleException("الحساب محذوف أو معطّل مسبقاً");

            // حسابات المتاجر والسائقين والعمليات والإدارة مرتبطة ببيانات تشغيلية: تُغلق عبر الدعم أو الإدارة
            if (user.Role != UserRoles.Customer)
                throw new BusinessRuleException("لا يمكن حذف هذا النوع من الحسابات من هنا، تواصل مع الدعم");

            // من يملك كلمة مرور يؤكدها (حماية من جهاز متروك مفتوحاً)؛ حساب Google بلا كلمة يكفيه جلسته
            if (user.HasPassword)
            {
                if (string.IsNullOrEmpty(password) || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                    throw new BusinessRuleException("كلمة المرور غير صحيحة");
            }

            if (await _context.Orders.AnyAsync(o => o.CustomerId == userId && !FinalOrderStatuses.Contains(o.Status)))
                throw new BusinessRuleException("لديك طلبات جارية، يمكنك حذف الحساب بعد اكتمالها");

            if (await _context.Returns.AnyAsync(r => r.CustomerId == userId
                    && (r.Status == ReturnStatus.PENDING || (r.Status == ReturnStatus.APPROVED && r.RefundedAt == null))))
                throw new BusinessRuleException("لديك طلب إرجاع قيد المعالجة، يمكنك حذف الحساب بعد اكتماله");

            await _avatars.RemoveAsync(userId);
            // RemoveAsync يحفظ تغييراته بنفسه؛ نعيد قراءة المستخدم المتتبَّع إن لزم
            user = await _context.Users.FirstAsync(u => u.Id == userId);

            // الطلبات تشير إلى العناوين: نمسح بياناتها الشخصية ولا نحذفها
            var addresses = await _context.Addresses.Where(a => a.UserId == userId).ToListAsync();
            foreach (var a in addresses)
            {
                a.Label = DeletedName;
                a.StreetAddress = "—";
                a.BuildingNumber = null;
                a.FloorNumber = null;
                a.ApartmentNumber = null;
                a.Phone = null;
                a.Notes = null;
                a.Latitude = null;
                a.Longitude = null;
                a.IsDefault = false;
            }

            _context.Wishlists.RemoveRange(_context.Wishlists.Where(w => w.UserId == userId));
            _context.PushSubscriptions.RemoveRange(_context.PushSubscriptions.Where(p => p.UserId == userId));
            _context.DeviceTokens.RemoveRange(_context.DeviceTokens.Where(d => d.UserId == userId));
            var carts = await _context.Carts.Include(c => c.Items).Where(c => c.UserId == userId).ToListAsync();
            foreach (var cart in carts) _context.CartItems.RemoveRange(cart.Items);
            _context.Carts.RemoveRange(carts);

            var now = DateTime.UtcNow;
            foreach (var t in await _context.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null).ToListAsync())
                t.RevokedAt = now;

            user.FullName = DeletedName;
            user.Email = $"deleted-{user.Id:N}@deleted.invalid";   // فريد: عمود البريد لا يقبل التكرار
            user.Phone = null;                                     // يتحرر الرقم لتسجيل جديد
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N"));
            user.HasPassword = false;
            user.GoogleId = null;
            user.GoogleEmail = null;
            user.GooglePictureUrl = null;
            user.AvatarUrl = null;
            user.AvatarSource = AvatarSources.None;
            user.ReferralCode = null;
            user.IsActive = false;                                 // الـ interceptor يرفع TokenVersion فتسقط كل التوكنات
            user.SessionsRevokedAt = now;
            user.UpdatedAt = now;

            await _context.SaveChangesAsync();
        }
    }
}
