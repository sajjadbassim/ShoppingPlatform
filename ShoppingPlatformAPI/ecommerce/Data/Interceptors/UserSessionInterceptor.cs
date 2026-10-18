using System.Runtime.CompilerServices;
using ecommerce.Core.Models;
using ecommerce.Services.AuthService;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace ecommerce.Data.Interceptors
{
    // إبطال الجلسات مركزياً: أي حفظ يغيّر دور المستخدم أو تفعيله أو كلمة مروره — من أي خدمة
    // (الإدارة، اعتماد المتجر، السائقين، استعادة كلمة المرور...) — يزيد TokenVersion فتُرفض توكنات الدخول القديمة فوراً.
    // تغيير كلمة المرور أو التعطيل ينهي رموز التجديد أيضاً؛ تغيير الدور لا ينهيها فيحصل المستخدم على توكن بدوره الجديد عند التجديد.
    public class UserSessionInterceptor : SaveChangesInterceptor
    {
        private readonly IUserSessionValidator _sessions;
        private readonly ConditionalWeakTable<DbContext, List<Guid>> _pending = new();

        public UserSessionInterceptor(IUserSessionValidator sessions) => _sessions = sessions;

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken ct = default)
        {
            if (eventData.Context is { } context)
                foreach (var entry in ModifiedUsers(context))
                    Stamp(context, entry, await entry.GetDatabaseValuesAsync(ct));
            return await base.SavingChangesAsync(eventData, result, ct);
        }

        public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
        {
            if (eventData.Context is { } context)
                foreach (var entry in ModifiedUsers(context))
                    Stamp(context, entry, entry.GetDatabaseValues());
            return base.SavingChanges(eventData, result);
        }

        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result, CancellationToken ct = default)
        {
            Flush(eventData.Context);
            return base.SavedChangesAsync(eventData, result, ct);
        }

        public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
        {
            Flush(eventData.Context);
            return base.SavedChanges(eventData, result);
        }

        public override void SaveChangesFailed(DbContextErrorEventData eventData)
        {
            if (eventData.Context != null) _pending.Remove(eventData.Context);
            base.SaveChangesFailed(eventData);
        }

        public override Task SaveChangesFailedAsync(DbContextErrorEventData eventData, CancellationToken ct = default)
        {
            if (eventData.Context != null) _pending.Remove(eventData.Context);
            return base.SaveChangesFailedAsync(eventData, ct);
        }

        private static List<EntityEntry<User>> ModifiedUsers(DbContext context) =>
            context.ChangeTracker.Entries<User>().Where(e => e.State == EntityState.Modified).ToList();

        // المقارنة مع القيم في القاعدة (لا OriginalValues) لأن المستخدم قد يُحمَّل بلا تتبع ثم يُحدَّث بـ Update
        private void Stamp(DbContext context, EntityEntry<User> entry, PropertyValues? stored)
        {
            if (stored == null) return;
            var user = entry.Entity;

            var roleChanged = stored.GetValue<string>(nameof(User.Role)) != user.Role
                // الصلاحيات ومتجر الموظف مثل الدور: التوكن القديم يُرفض والتجديد يعطي التوكن الجديد
                || stored.GetValue<string?>(nameof(User.Permissions)) != user.Permissions
                || stored.GetValue<Guid?>(nameof(User.StaffVendorId)) != user.StaffVendorId;
            var passwordChanged = stored.GetValue<string>(nameof(User.PasswordHash)) != user.PasswordHash;
            var wasActive = stored.GetValue<bool>(nameof(User.IsActive));
            if (!roleChanged && !passwordChanged && wasActive == user.IsActive)
                return;

            user.TokenVersion = stored.GetValue<int>(nameof(User.TokenVersion)) + 1;
            if (passwordChanged || (wasActive && !user.IsActive))
                user.SessionsRevokedAt = DateTime.UtcNow;

            _pending.GetOrCreateValue(context).Add(user.Id);
            _sessions.Invalidate(user.Id);
        }

        // مسح ثانٍ بعد الحفظ: طلب متزامن قد يكون خزّن الحالة القديمة بين المسح الأول والحفظ
        private void Flush(DbContext? context)
        {
            if (context == null || !_pending.TryGetValue(context, out var ids)) return;
            foreach (var id in ids) _sessions.Invalidate(id);
            _pending.Remove(context);
        }
    }
}
