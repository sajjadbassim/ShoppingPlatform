using System.Security.Claims;
using System.Text.Json;
using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Data.Interceptors;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ecommerce.Services.ActivityLogService
{
    public interface IActivityLogService
    {
        Task RecordActionAsync(HttpContext http, string controller, string action);
        Task RecordLoginAsync(User user, bool success, string? note = null);
        Task<(List<ActivityLogDto> Items, int Total)> QueryAsync(ActivityLogQuery q, Guid viewerId, string viewerRole, CancellationToken ct = default);
        Task<int> PurgeOlderThanAsync(int days, CancellationToken ct = default);
    }

    // سجل النشاط لكل الأدوار عدا الزبون. الكتابة في سياق مستقل: لا تحفظ بالخطأ ما بقي معلّقاً في سياق الطلب،
    // وفشلها لا يُفشل الإجراء أبداً
    public class ActivityLogService : IActivityLogService
    {
        // العربي يُخزَّن كما هو (لا \uXXXX) — ليعمل البحث داخل التفاصيل ويصغر الحجم
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
        // أنواع تعرّف الإجراء للقارئ أكثر من غيرها (الطلب قبل سطور الدفتر مثلاً)
        private static readonly string[] MainTypes =
            { "SubOrder", "Order", "Return", "Product", "Vendor", "Driver", "User", "Coupon", "Promotion", "Category", "DeliveryZone", "ReturnTrip" };

        private readonly DbContextOptions<AppDbContext> _options;
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _http;
        private readonly ILogger<ActivityLogService>? _logger;

        public ActivityLogService(DbContextOptions<AppDbContext> options, AppDbContext context, IHttpContextAccessor http,
            ILogger<ActivityLogService>? logger = null)
        {
            _options = options;
            _context = context;
            _http = http;
            _logger = logger;
        }

        // ===================================
        // الكتابة
        // ===================================
        public async Task RecordActionAsync(HttpContext http, string controller, string action)
        {
            try
            {
                var user = http.User;
                var role = user.FindFirstValue(ClaimTypes.Role);
                if (!Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)
                    || string.IsNullOrEmpty(role) || role == UserRoles.Customer) return;

                var changes = http.Items[ActivityChangeInterceptor.ItemsKey] as List<ActivityChangeInterceptor.EntityChange>
                    ?? new List<ActivityChangeInterceptor.EntityChange>();
                var key = $"{controller}.{action}";
                var main = MainTypes.Select(t => changes.FirstOrDefault(c => c.Type == t && c.Label != null)).FirstOrDefault(c => c != null);

                await using var db = new AppDbContext(_options);
                var actor = await ActorAsync(db, userId, role);
                var vendorIds = changes.Where(c => c.VendorId != null).Select(c => c.VendorId!.Value)
                    .Append(actor.VendorId ?? Guid.Empty).Where(id => id != Guid.Empty).Distinct().Take(20).ToList();

                db.ActivityLogs.Add(new ActivityLog
                {
                    ActorUserId = userId,
                    ActorRole = role,
                    ActorName = actor.Name,
                    ActorVendorId = actor.VendorId,
                    Action = key,
                    Kind = ActivityKind.Action,
                    Summary = Trim(ActivityActions.Label(key) + (main?.Label != null ? $" — {main.Label}" : "")
                        + (http.Items[NoteKey] is string note ? $" — {note}" : ""), 500),
                    VendorIds = vendorIds.Count == 0 ? null : "," + string.Join(",", vendorIds) + ",",
                    Details = changes.Count == 0 ? null : JsonSerializer.Serialize(changes, Json),
                    HttpMethod = http.Request.Method,
                    Path = Trim(http.Request.Path.Value, 300),
                    Ip = http.Connection.RemoteIpAddress?.ToString(),
                    UserAgent = Trim(http.Request.Headers.UserAgent.ToString(), 300),
                });
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Activity log write failed: {Controller}.{Action}", controller, action);
            }
        }

        public async Task RecordLoginAsync(User user, bool success, string? note = null)
        {
            if (user.Role == UserRoles.Customer) return;
            try
            {
                var http = _http.HttpContext;
                await using var db = new AppDbContext(_options);
                var actor = await ActorAsync(db, user.Id, user.Role);
                var key = success ? ActivityActions.Login : ActivityActions.LoginFailed;
                db.ActivityLogs.Add(new ActivityLog
                {
                    ActorUserId = user.Id,
                    ActorRole = user.Role,
                    ActorName = user.FullName,
                    ActorVendorId = actor.VendorId,
                    Action = key,
                    Kind = ActivityKind.Auth,
                    Summary = note ?? ActivityActions.Label(key),
                    VendorIds = actor.VendorId is Guid v ? $",{v}," : null,
                    HttpMethod = http?.Request.Method,
                    Path = http?.Request.Path.Value,
                    Ip = http?.Connection.RemoteIpAddress?.ToString(),
                    UserAgent = Trim(http?.Request.Headers.UserAgent.ToString(), 300),
                });
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Activity log login write failed: {UserId}", user.Id);
            }
        }

        // ملاحظة يضيفها الإجراء لسطره (مثل عدد السجلات المحذوفة)
        public const string NoteKey = "__activity_note";

        // ===================================
        // الحذف: يدوي من الأدمن (يبقي آخر 30 يوماً) وتلقائي يومياً (ما مضى عليه أكثر من 60 يوماً)
        // ===================================
        public async Task<int> PurgeOlderThanAsync(int days, CancellationToken ct = default)
        {
            var cutoff = DateTime.UtcNow.AddDays(-days);
            if (_context.Database.IsRelational())
                return await _context.ActivityLogs.Where(l => l.At < cutoff).ExecuteDeleteAsync(ct);
            // قاعدة الاختبارات (InMemory) لا تدعم الحذف المباشر
            var old = await _context.ActivityLogs.Where(l => l.At < cutoff).ToListAsync(ct);
            _context.ActivityLogs.RemoveRange(old);
            await _context.SaveChangesAsync(ct);
            return old.Count;
        }

        private static async Task<(string? Name, Guid? VendorId)> ActorAsync(AppDbContext db, Guid userId, string role)
        {
            var name = await db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.FullName).FirstOrDefaultAsync();
            Guid? vendorId = role == UserRoles.Vendor
                ? await ecommerce.Core.Constants.VendorMembership.VendorIdOfAsync(db, userId)
                : null;
            return (name, vendorId);
        }

        // ===================================
        // القراءة — كل دور يرى نطاقه:
        // الأدمن الكل · العمليات نشاط فريقها · المتجر نشاطه وما فعلته الإدارة/العمليات بطلباته ومنتجاته · السائق نشاطه
        // ===================================
        public async Task<(List<ActivityLogDto> Items, int Total)> QueryAsync(ActivityLogQuery q, Guid viewerId, string viewerRole, CancellationToken ct = default)
        {
            var query = _context.ActivityLogs.AsNoTracking().AsQueryable();
            Guid? myVendor = null;
            // الحساب المساعد يرى نشاطه فقط: موظف المتجر، والمسؤول المحدود بلا صلاحية «سجل النشاط»
            var access = await _context.Users.AsNoTracking().Where(u => u.Id == viewerId)
                .Select(u => new { u.StaffVendorId, u.Permissions }).FirstOrDefaultAsync(ct);
            if ((viewerRole == UserRoles.Vendor && access?.StaffVendorId != null)
                || (viewerRole == UserRoles.Admin && access?.Permissions != null
                    && !StaffPermissions.Parse(access.Permissions).Contains(StaffPermissions.Activity)))
                q.Mine = true;
            switch (viewerRole)
            {
                case UserRoles.Admin:
                    break;
                case UserRoles.Ops:
                    query = query.Where(l => l.ActorRole == UserRoles.Ops);
                    break;
                case UserRoles.Vendor:
                    myVendor = await ecommerce.Core.Constants.VendorMembership.VendorIdOfAsync(_context, viewerId, ct);
                    if (myVendor == null) return (new(), 0);
                    var tag = $",{myVendor},";
                    query = query.Where(l => l.ActorVendorId == myVendor || (l.VendorIds != null && l.VendorIds.Contains(tag)));
                    break;
                case UserRoles.Driver:
                    query = query.Where(l => l.ActorUserId == viewerId);
                    break;
                default:
                    return (new(), 0);
            }

            if (q.Mine) query = query.Where(l => l.ActorUserId == viewerId);
            if (!string.IsNullOrWhiteSpace(q.Kind)) query = query.Where(l => l.Kind == q.Kind);
            if (!string.IsNullOrWhiteSpace(q.Role)) query = query.Where(l => l.ActorRole == q.Role);
            if (q.UserId is Guid uid) query = query.Where(l => l.ActorUserId == uid);
            if (q.VendorId is Guid vid && viewerRole == UserRoles.Admin)
            {
                var tag = $",{vid},";
                query = query.Where(l => l.ActorVendorId == vid || (l.VendorIds != null && l.VendorIds.Contains(tag)));
            }
            if (q.FailedLoginsOnly) query = query.Where(l => l.Action == ActivityActions.LoginFailed);
            if (q.From is DateTime from) query = query.Where(l => l.At >= from);
            if (q.To is DateTime to) query = query.Where(l => l.At < to);
            if (!string.IsNullOrWhiteSpace(q.Search))
            {
                var s = q.Search.Trim();
                query = query.Where(l => l.Summary.Contains(s) || (l.ActorName != null && l.ActorName.Contains(s)) || (l.Details != null && l.Details.Contains(s)));
            }

            var total = await query.CountAsync(ct);
            var page = Math.Max(1, q.Page);
            var size = Math.Clamp(q.PageSize, 1, 100);
            var rows = await query.OrderByDescending(l => l.At).Skip((page - 1) * size).Take(size).ToListAsync(ct);

            var items = rows.Select(l =>
            {
                // المتجر يرى ما فعلته الإدارة/العمليات بطلباته — باسم الدور لا اسم الموظف، وبلا التفاصيل الداخلية
                var foreign = viewerRole == UserRoles.Vendor && l.ActorVendorId != myVendor;
                return new ActivityLogDto
                {
                    Id = l.Id,
                    At = l.At,
                    ActorUserId = foreign ? null : l.ActorUserId,
                    ActorRole = l.ActorRole,
                    ActorName = foreign ? RoleAr(l.ActorRole) : l.ActorName,
                    Action = l.Action,
                    Kind = l.Kind,
                    Summary = l.Summary,
                    Details = foreign || l.Details == null ? null : JsonSerializer.Deserialize<JsonElement>(l.Details),
                    Ip = viewerRole == UserRoles.Admin || l.ActorUserId == viewerId ? l.Ip : null,
                    Device = viewerRole == UserRoles.Admin || l.ActorUserId == viewerId ? l.UserAgent : null,
                };
            }).ToList();
            return (items, total);
        }

        public static string RoleAr(string role) => role switch
        {
            UserRoles.Admin => "الإدارة",
            UserRoles.Ops => "فريق العمليات",
            UserRoles.Vendor => "المتجر",
            UserRoles.Driver => "السائق",
            _ => role,
        };

        private static string? Trim(string? s, int max) => s == null || s.Length <= max ? s : s[..max];
    }

    public class ActivityLogQuery
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 30;
        public string? Kind { get; set; }
        public string? Role { get; set; }
        public Guid? UserId { get; set; }
        public Guid? VendorId { get; set; }
        public bool Mine { get; set; }
        public bool FailedLoginsOnly { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public string? Search { get; set; }
    }

    public class ActivityLogDto
    {
        public Guid Id { get; set; }
        public DateTime At { get; set; }
        public Guid? ActorUserId { get; set; }
        public string ActorRole { get; set; } = "";
        public string? ActorName { get; set; }
        public string Action { get; set; } = "";
        public string Kind { get; set; } = "";
        public string Summary { get; set; } = "";
        public JsonElement? Details { get; set; }
        public string? Ip { get; set; }
        public string? Device { get; set; }
    }

    // حذف تلقائي: كل يوم يُحذف ما مضى عليه أكثر من 60 يوماً — السجل يبقى دائماً آخر 60 يوماً فقط
    public class ActivityLogRetentionService : BackgroundService
    {
        public const int RetentionDays = 60;
        private static readonly TimeSpan CheckInterval = TimeSpan.FromHours(24);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<ActivityLogRetentionService> _logger;

        public ActivityLogRetentionService(IServiceScopeFactory scopeFactory, ILogger<ActivityLogRetentionService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // أول فحص بعد دقيقة من التشغيل (لا يبطئ الإقلاع)، ثم كل 24 ساعة
            try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); } catch (OperationCanceledException) { return; }
            using var timer = new PeriodicTimer(CheckInterval);
            do
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var deleted = await scope.ServiceProvider.GetRequiredService<IActivityLogService>().PurgeOlderThanAsync(RetentionDays, stoppingToken);
                    if (deleted > 0) _logger.LogInformation("Activity log retention: deleted {Count} rows older than {Days} days", deleted, RetentionDays);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Activity log retention job failed");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
    }
}
