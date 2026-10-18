using ecommerce.Core.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Data
{
    // قفل حصري على طلب (أو سائق) حتى نهاية العملية: ضغطتان متزامنتان (تأكيد + رفض، تأكيد مرتين، متجران معاً)
    // تُنفَّذان واحدة بعد الأخرى، فتجد الثانية الحالة الجديدة وترفضها شروطُ الحالة بدل أن تنجح الاثنتان.
    // القفل مملوك للجلسة (لا لمعاملة) فتبقى الحفظات والإشعارات كما هي، ويُفتح الاتصال طوال مدته.
    // يُؤخذ قبل قراءة الطلب/الأجزاء — وإلا تبقى في الذاكرة نسخة قديمة قُرئت قبل القفل.
    public sealed class OrderLock : IAsyncDisposable
    {
        private const int TimeoutMs = 15000;
        private readonly AppDbContext? _context;
        private readonly string _resource;

        private OrderLock(AppDbContext? context, string resource)
        {
            _context = context;
            _resource = resource;
        }

        public static Task<OrderLock> ForOrderAsync(AppDbContext context, Guid orderId, CancellationToken ct = default)
            => AcquireAsync(context, "order:" + orderId, ct);

        public static Task<OrderLock> ForDriverAsync(AppDbContext context, Guid driverId, CancellationToken ct = default)
            => AcquireAsync(context, "driver:" + driverId, ct);

        // مراجعة/ردّ مبلغ طلب إرجاع: موافقتان متزامنتان (العمليات والأدمن) لا تنجحان معاً
        public static Task<OrderLock> ForReturnAsync(AppDbContext context, Guid returnId, CancellationToken ct = default)
            => AcquireAsync(context, "return:" + returnId, ct);

        // رصيد نقاط الزبون — يُؤخذ دائماً بعد قفل الطلب إن وُجد (الطلب ثم السائق ثم النقاط)
        public static Task<OrderLock> ForLoyaltyAsync(AppDbContext context, Guid userId, CancellationToken ct = default)
            => AcquireAsync(context, "loyalty:" + userId, ct);

        // سلة الزبون: إضافتان متزامنتان تُدمجان في سطر واحد ولا تتجاوزان المخزون، والإضافة أثناء
        // إرسال الطلب تنتظره (نفس المورد الذي يأخذه إنشاء الطلب) فلا تُمسح مع السلة
        public static Task<OrderLock> ForCartAsync(AppDbContext context, Guid userId, CancellationToken ct = default)
            => AcquireAsync(context, CartResource(userId), ct);

        public static string CartResource(Guid userId) => "cart:" + userId;

        // دفتر حساب المتجر: دفعتان متزامنتان لا تتجاوزان الرصيد معاً
        public static Task<OrderLock> ForVendorLedgerAsync(AppDbContext context, Guid vendorId, CancellationToken ct = default)
            => AcquireAsync(context, "vendor-ledger:" + vendorId, ct);

        // قفل الطلب الذي يتبعه الجزء — null إن لم يوجد الجزء
        public static async Task<OrderLock?> ForSubOrderAsync(AppDbContext context, Guid subOrderId, CancellationToken ct = default)
        {
            var orderId = await context.SubOrders.AsNoTracking()
                .Where(so => so.Id == subOrderId).Select(so => (Guid?)so.OrderId).FirstOrDefaultAsync(ct);
            return orderId is Guid id ? await ForOrderAsync(context, id, ct) : null;
        }

        private static async Task<OrderLock> AcquireAsync(AppDbContext context, string resource, CancellationToken ct)
        {
            // قاعدة الاختبارات (InMemory) بلا أقفال
            if (!context.Database.IsSqlServer()) return new OrderLock(null, resource);

            await context.Database.OpenConnectionAsync(ct);
            int result;
            try
            {
                result = (await context.Database.SqlQuery<int>(
                    $"DECLARE @r int; EXEC @r = sp_getapplock @Resource = {resource}, @LockMode = 'Exclusive', @LockOwner = 'Session', @LockTimeout = {TimeoutMs}; SELECT @r AS [Value]")
                    .ToListAsync(ct)).FirstOrDefault(-1);
            }
            catch
            {
                await context.Database.CloseConnectionAsync();
                throw;
            }
            if (result < 0)
            {
                await context.Database.CloseConnectionAsync();
                throw new ConflictException("الطلب قيد التحديث الآن من جهة أخرى — حاول بعد لحظات");
            }
            return new OrderLock(context, resource);
        }

        public async ValueTask DisposeAsync()
        {
            if (_context == null) return;
            try
            {
                await _context.Database.ExecuteSqlAsync($"EXEC sp_releaseapplock @Resource = {_resource}, @LockOwner = 'Session'");
            }
            finally
            {
                await _context.Database.CloseConnectionAsync();
            }
        }
    }
}
