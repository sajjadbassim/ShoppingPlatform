using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Data
{
    // أرقام يومية متسلسلة مثل ORD-20261005-0042.
    // القراءة ثم +1 تعطي طلبين متزامنين نفس الرقم فيرفض الفهرس الفريد أحدهما؛
    // هنا يُحجز الرقم من عدّاد في جملة MERGE واحدة، وداخل معاملة يبقى صف العدّاد مقفلاً حتى نهايتها.
    public static class DailyNumberGenerator
    {
        private const string ReserveSql = """
            MERGE [number_sequences] WITH (HOLDLOCK) AS t
            USING (SELECT @key AS [key]) AS s ON t.[key] = s.[key]
            WHEN MATCHED THEN UPDATE SET t.[last_value] = CASE WHEN t.[last_value] > @seed THEN t.[last_value] + 1 ELSE @seed + 1 END
            WHEN NOT MATCHED THEN INSERT ([key], [last_value]) VALUES (s.[key], @seed + 1)
            OUTPUT inserted.[last_value] AS [Value];
            """;

        // existingNumbers: أرقام هذا النوع الموجودة (لبدء العدّاد بعد أي رقم كُتب دون المولّد، مثل بيانات التجربة)
        public static async Task<string> NextAsync(
            AppDbContext context, string prefix, IQueryable<string> existingNumbers, CancellationToken ct = default)
        {
            // يوم بغداد لا يوم UTC: طلب بعد منتصف الليل يحمل تاريخ اليوم الجديد (مثل الفواتير والتقارير)
            var dayKey = $"{prefix}-{ecommerce.Core.Constants.IraqTime.FromUtc(DateTime.UtcNow):yyyyMMdd}";
            var lastExisting = await existingNumbers
                .Where(n => n.StartsWith(dayKey + "-"))
                .OrderByDescending(n => n)
                .FirstOrDefaultAsync(ct);
            var seed = ParseSequence(lastExisting);

            // مزوّد InMemory في الاختبارات لا ينفّذ SQL
            var next = context.Database.IsRelational()
                ? (await context.Database
                    .SqlQueryRaw<int>(ReserveSql, new SqlParameter("@key", dayKey), new SqlParameter("@seed", seed))
                    .ToListAsync(ct)).Single()
                : seed + 1;

            return $"{dayKey}-{next:D4}";
        }

        private static int ParseSequence(string? number)
        {
            var last = number?.Split('-').LastOrDefault();
            return int.TryParse(last, out var sequence) ? sequence : 0;
        }
    }
}
