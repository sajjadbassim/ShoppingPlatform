using ecommerce.Core.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Data
{
    public class UnitOfWork : IUnitOfWork
    {
        private readonly AppDbContext _context;

        public UnitOfWork(AppDbContext context) => _context = context;

        public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
            _context.SaveChangesAsync(ct);

        public async Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken ct = default)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _context.Database.BeginTransactionAsync(ct);
                await operation();
                await _context.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
            });
        }
    }
}
