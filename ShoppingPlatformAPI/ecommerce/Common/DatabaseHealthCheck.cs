using ecommerce.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ecommerce.Common
{
    // فحص الاتصال بقاعدة البيانات لصفحة /health
    public class DatabaseHealthCheck : IHealthCheck
    {
        private readonly AppDbContext _context;

        public DatabaseHealthCheck(AppDbContext context) => _context = context;

        public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
        {
            try
            {
                return await _context.Database.CanConnectAsync(ct)
                    ? HealthCheckResult.Healthy()
                    : HealthCheckResult.Unhealthy("تعذّر الاتصال بقاعدة البيانات");
            }
            catch (Exception ex)
            {
                return HealthCheckResult.Unhealthy("تعذّر الاتصال بقاعدة البيانات", ex);
            }
        }
    }
}
