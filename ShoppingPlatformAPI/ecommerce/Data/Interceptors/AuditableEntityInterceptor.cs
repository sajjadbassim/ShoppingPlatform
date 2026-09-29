using ecommerce.Core.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace ecommerce.Data.Interceptors
{
    public class AuditableEntityInterceptor : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken ct = default)
        {
            var context = eventData.Context;
            if (context is null) return base.SavingChangesAsync(eventData, result, ct);

            var now = DateTime.UtcNow;
            foreach (var entry in context.ChangeTracker.Entries<IAuditableEntity>())
            {
                if (entry.State == EntityState.Added)
                    entry.Entity.CreatedAt = now;
                else if (entry.State == EntityState.Modified)
                    entry.Entity.UpdatedAt = now;
            }

            return base.SavingChangesAsync(eventData, result, ct);
        }
    }
}
