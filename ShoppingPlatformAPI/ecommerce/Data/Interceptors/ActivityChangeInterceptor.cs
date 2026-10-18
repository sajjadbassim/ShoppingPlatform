using ecommerce.Core.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace ecommerce.Data.Interceptors
{
    // يلتقط ما سيتغيّر في قاعدة البيانات أثناء الطلب (قبل الحفظ، فالقيم القديمة متاحة) ويضعه في HttpContext.Items —
    // ActivityLogFilter يكتبه في سجل النشاط إن نجح الطلب وكان المنفّذ ليس زبوناً
    public class ActivityChangeInterceptor : SaveChangesInterceptor
    {
        public const string ItemsKey = "__activity_changes";
        private const int MaxEntities = 40;
        private const int MaxValue = 200;

        // لا تُسجَّل أبداً (كلمات المرور، الرموز، الأسرار)
        private static readonly string[] Sensitive = { "password", "token", "secret", "hash", "otp", "accesskey", "salt" };
        // ضجيج لا يفيد القارئ
        private static readonly HashSet<string> Noise = new(StringComparer.OrdinalIgnoreCase) { "CreatedAt", "UpdatedAt", "RowVersion" };
        // أسماء الخصائص التي تعرّف السطر للقارئ (رقم الطلب، اسم المنتج…) بالترتيب
        private static readonly string[] LabelProps = { "SubOrderNumber", "OrderNumber", "ReturnNumber", "NameAr", "Name", "FullName", "Code", "Title", "Phone" };
        // كيانات لا تهم القارئ
        private static readonly HashSet<string> SkipTypes = new() { nameof(ActivityLog), "Notification", "RefreshToken", "PushSubscription", "UserSession" };

        private readonly IHttpContextAccessor _http;

        public ActivityChangeInterceptor(IHttpContextAccessor http) => _http = http;

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken ct = default)
        {
            Capture(eventData.Context);
            return base.SavingChangesAsync(eventData, result, ct);
        }

        public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
        {
            Capture(eventData.Context);
            return base.SavingChanges(eventData, result);
        }

        private void Capture(DbContext? context)
        {
            var http = _http.HttpContext;
            if (context == null || http == null || HttpMethods.IsGet(http.Request.Method)) return;
            try
            {
                if (http.Items[ItemsKey] is not List<EntityChange> list)
                    http.Items[ItemsKey] = list = new List<EntityChange>();

                foreach (var entry in context.ChangeTracker.Entries())
                {
                    if (list.Count >= MaxEntities) break;
                    if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted)) continue;
                    var type = entry.Metadata.ClrType.Name;
                    if (SkipTypes.Contains(type)) continue;

                    var change = new EntityChange
                    {
                        Type = type,
                        Id = KeyOf(entry),
                        State = entry.State.ToString(),
                        Label = LabelOf(entry),
                        VendorId = VendorOf(entry),
                    };
                    foreach (var p in entry.Properties)
                    {
                        var name = p.Metadata.Name;
                        if (Noise.Contains(name) || p.Metadata.IsPrimaryKey()) continue;
                        if (Sensitive.Any(s => name.Contains(s, StringComparison.OrdinalIgnoreCase))) continue;
                        if (entry.State == EntityState.Modified)
                        {
                            if (!p.IsModified || Equals(p.OriginalValue, p.CurrentValue)) continue;
                            change.Changes.Add(new PropertyChange(name, Show(p.OriginalValue), Show(p.CurrentValue)));
                        }
                        else if (entry.State == EntityState.Added && p.CurrentValue != null)
                            change.Changes.Add(new PropertyChange(name, null, Show(p.CurrentValue)));
                    }
                    // نفس السطر حُفظ مرتين في الطلب: نضمّ التغييرات بدل تكراره
                    var same = list.FirstOrDefault(c => c.Type == change.Type && c.Id == change.Id);
                    if (same == null) list.Add(change);
                    else foreach (var c in change.Changes)
                    {
                        var prev = same.Changes.FirstOrDefault(x => x.P == c.P);
                        if (prev == null) same.Changes.Add(c);
                        else same.Changes[same.Changes.IndexOf(prev)] = prev with { N = c.N };
                    }
                }
            }
            catch { /* السجل لا يُفشل الحفظ أبداً */ }
        }

        private static string? KeyOf(EntityEntry e)
        {
            var key = e.Metadata.FindPrimaryKey();
            return key == null ? null : string.Join(",", key.Properties.Select(p => e.Property(p.Name).CurrentValue?.ToString()));
        }

        private static string? LabelOf(EntityEntry e)
        {
            foreach (var name in LabelProps)
            {
                var p = e.Metadata.FindProperty(name);
                if (p == null || Sensitive.Any(s => name.Contains(s, StringComparison.OrdinalIgnoreCase))) continue;
                var v = e.Property(name).CurrentValue?.ToString();
                if (!string.IsNullOrWhiteSpace(v)) return Trim(v);
            }
            return null;
        }

        private static Guid? VendorOf(EntityEntry e)
        {
            if (e.Metadata.ClrType == typeof(Vendor)) return e.Property(nameof(Vendor.Id)).CurrentValue as Guid?;
            var p = e.Metadata.FindProperty("VendorId");
            return p == null ? null : e.Property("VendorId").CurrentValue as Guid?;
        }

        private static string? Show(object? v) => v switch
        {
            null => null,
            DateTime d => d.ToString("yyyy-MM-dd HH:mm:ss") + "Z",
            decimal m => m.ToString("0.##"),
            bool b => b ? "true" : "false",
            _ => Trim(v.ToString()),
        };

        private static string? Trim(string? s) => s == null || s.Length <= MaxValue ? s : s[..MaxValue] + "…";

        public class EntityChange
        {
            public string Type { get; set; } = "";
            public string? Id { get; set; }
            public string State { get; set; } = "";
            public string? Label { get; set; }
            public Guid? VendorId { get; set; }
            public List<PropertyChange> Changes { get; set; } = new();
        }

        public record PropertyChange(string P, string? O, string? N);
    }
}
