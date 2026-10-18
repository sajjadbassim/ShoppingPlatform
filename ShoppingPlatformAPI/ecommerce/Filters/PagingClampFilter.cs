using Microsoft.AspNetCore.Mvc.Filters;

namespace ecommerce.Filters
{
    // كل واجهة تأخذ pageNumber/pageSize: قيمة خارج المدى تُستبدل بأقرب قيمة صالحة —
    // حجم صفحة سالب كان يعطي خطأ 500، وصفر يعطي عدد صفحات سالب، والكبير جداً يحمّل الجدول كله
    public class PagingClampFilter : IActionFilter
    {
        public const int MaxPageSize = 200;   // أكبر ما تطلبه الواجهات (صفحة الإرجاعات)

        public void OnActionExecuting(ActionExecutingContext context)
        {
            var args = context.ActionArguments;
            if (args.TryGetValue("pageNumber", out var n) && n is int number && number < 1)
                args["pageNumber"] = 1;
            if (args.TryGetValue("page", out var p) && p is int page && page < 1)
                args["page"] = 1;
            // أسماء أخرى لعدد النتائج (take=-5 في الإشعارات كان يعطي خطأ 500)
            foreach (var name in SizeNames)
                if (args.TryGetValue(name, out var v) && v is int size && (size < 1 || size > MaxPageSize))
                    args[name] = Math.Clamp(size, 1, MaxPageSize);
        }

        private static readonly string[] SizeNames = { "pageSize", "take", "count", "limit", "max", "maxResults" };

        public void OnActionExecuted(ActionExecutedContext context) { }
    }
}
