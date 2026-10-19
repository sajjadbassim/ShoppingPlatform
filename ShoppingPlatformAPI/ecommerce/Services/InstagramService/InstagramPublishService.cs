using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.RegularExpressions;
using ecommerce.Core.DTO.Instagram;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.SocialPublishService;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.InstagramService
{
    // نشر منتجات التاجر على حساب إنستغرام المربوط بمتجره (instagram_business_content_publish).
    // التاجر يختار الصور والنص ويضغط «نشر» بنفسه — لا نشر تلقائي دون فعل صريح منه.
    // الخطوات: تجهيز الصور (JPEG مربع) ← حاوية (صورة، ريلز، أو ألبوم) ← انتظار الجاهزية ← media_publish ← ربط المنشور بالمنتج.
    // الوسائط: صور المنتج، أو صور وفيديوهات رفعها التاجر من الاستوديو (ISocialMediaStore)
    public interface IInstagramPublishService
    {
        Task<InstagramPublishOptionsDto> GetOptionsAsync(Guid userId, Guid productId, CancellationToken ct = default);
        Task<InstagramPostDto> CreateAsync(Guid userId, CreateInstagramPostDto dto, CancellationToken ct = default);
        Task<List<InstagramPostDto>> ListAsync(Guid userId, CancellationToken ct = default);
        Task<InstagramPostDto> CancelAsync(Guid userId, Guid postId, CancellationToken ct = default);
        Task<InstagramPostDto> RetryAsync(Guid userId, Guid postId, CancellationToken ct = default);

        // الخلفية: المنشورات المجدولة التي حان وقتها
        Task<int> ProcessDueAsync(CancellationToken ct = default);
    }

    public class InstagramPublishService : IInstagramPublishService
    {
        public const int MaxImages = 10;
        public const int MaxHashtags = 30;
        public const int MaxMentions = 20;
        private const int MaxAttempts = 3;
        private static readonly TimeSpan MaxScheduleAhead = TimeSpan.FromDays(30);
        private static readonly TimeSpan StuckPublishing = TimeSpan.FromMinutes(10);
        // الفيديو قد يبقى قيد المعالجة عند إنستغرام دقائق — يُعاد فحصه حتى هذا العدد من المحاولات
        private const int MaxProcessingChecks = 10;
        private static readonly TimeSpan UploadCleanupInterval = TimeSpan.FromHours(1);
        private static DateTime _lastUploadCleanup = DateTime.MinValue;

        // حجز المنشور أثناء نشره: الخادم عملية واحدة (الخلفية + طلبات التاجر)، فقفل لكل منشور
        // مع فحص الحالة يمنع نشره مرتين
        private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> PostLocks = new();

        private readonly AppDbContext _context;
        private readonly IInstagramService _instagram;
        private readonly IInstagramApiClient _api;
        private readonly IInstagramImagePreparer _images;
        private readonly ISocialMediaStore _uploads;
        private readonly InstagramOptions _options;
        private readonly TimeProvider _time;
        private readonly ILogger<InstagramPublishService> _logger;

        public InstagramPublishService(AppDbContext context, IInstagramService instagram, IInstagramApiClient api,
            IInstagramImagePreparer images, ISocialMediaStore uploads, IOptions<InstagramOptions> options, TimeProvider time,
            ILogger<InstagramPublishService> logger)
        {
            _uploads = uploads;
            _context = context;
            _instagram = instagram;
            _api = api;
            _images = images;
            _options = options.Value;
            _time = time;
            _logger = logger;
        }

        private DateTime Now => _time.GetUtcNow().UtcDateTime;
        private bool PublishingEnabled => _options.IsConfigured && !string.IsNullOrWhiteSpace(_options.PublicBaseUrl);

        // ===================================
        // شاشة النشر
        // ===================================
        public async Task<InstagramPublishOptionsDto> GetOptionsAsync(Guid userId, Guid productId, CancellationToken ct = default)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            var product = await LoadProductAsync(vendorId, productId, ct);
            var connection = await _context.Set<InstagramConnection>().AsNoTracking().FirstOrDefaultAsync(c => c.VendorId == vendorId, ct);

            var dto = new InstagramPublishOptionsDto
            {
                PublishingEnabled = PublishingEnabled,
                Connected = connection != null,
                NeedsReconnect = connection?.NeedsReconnect ?? false,
                Username = connection?.Username,
                ProfilePictureUrl = connection?.ProfilePictureUrl,
                ProductId = product.Id,
                ProductName = product.NameAr ?? product.Name,
                StoreName = product.Vendor?.NameAr ?? product.Vendor?.Name,
                StoreLogoUrl = product.Vendor?.LogoUrl,
                Images = ProductImages(product),
                SuggestedCaption = BuildCaption(product)
            };

            if (connection != null && !connection.NeedsReconnect && PublishingEnabled)
            {
                try
                {
                    var session = await _instagram.GetPublishSessionAsync(vendorId, ct);
                    dto.CanPublish = session.CanPublish;
                    if (session.CanPublish)
                    {
                        var limit = await _api.GetPublishingLimitAsync(session.AccessToken, session.IgUserId, ct);
                        dto.QuotaUsage = limit?.QuotaUsage;
                        dto.QuotaTotal = limit?.Config?.QuotaTotal;
                    }
                }
                catch (InstagramApiException ex)
                {
                    dto.NeedsReconnect = ex.RequiresReconnect;
                    _logger.LogInformation("Instagram publish options: {Code}", ex.Code);
                }
            }
            return dto;
        }

        // ===================================
        // إنشاء منشور (الآن أو بموعد)
        // ===================================
        public async Task<InstagramPostDto> CreateAsync(Guid userId, CreateInstagramPostDto dto, CancellationToken ct = default)
        {
            if (!PublishingEnabled)
                throw new BusinessRuleException("النشر على إنستغرام غير مفعّل على المنصة بعد");

            var vendorId = await GetVendorIdAsync(userId, ct);
            var product = await LoadProductAsync(vendorId, dto.ProductId, ct);

            var caption = (dto.Caption ?? "").Trim();
            ValidateCaption(caption);

            // صور المنتج نفسه، أو ما رفعه هذا المتجر من الاستوديو — لا مسارات عشوائية
            var allowed = ProductImages(product);
            var images = dto.Images.Where(i => !string.IsNullOrWhiteSpace(i)).Distinct().ToList();
            if (images.Count is < 1 or > MaxImages)
                throw new BusinessRuleException($"اختر من عنصر واحد إلى {MaxImages} عناصر (صور أو فيديو)");
            if (images.Any(i => !allowed.Contains(i) && !_uploads.IsVendorUpload(vendorId, i)))
                throw new BusinessRuleException("أحد الملفات لا يخص هذا المنتج أو متجرك");

            var scheduledAt = dto.ScheduledAt?.ToUniversalTime();
            if (scheduledAt.HasValue)
            {
                if (scheduledAt.Value < Now.AddMinutes(-1))
                    throw new BusinessRuleException("موعد النشر في الماضي");
                if (scheduledAt.Value > Now + MaxScheduleAhead)
                    throw new BusinessRuleException("يمكن جدولة النشر حتى 30 يوماً فقط");
            }

            var session = await _instagram.GetPublishSessionAsync(vendorId, ct);
            if (!session.CanPublish)
                throw new BusinessRuleException("أعد ربط حساب إنستغرام ووافق على صلاحية النشر");

            var post = new InstagramPost
            {
                VendorId = vendorId,
                ProductId = product.Id,
                CreatedByUserId = userId,
                Caption = caption,
                SourceImagesJson = JsonSerializer.Serialize(images),
                Status = InstagramPost.StatusScheduled,
                ScheduledAt = scheduledAt ?? Now
            };
            _context.Add(post);
            await _context.SaveChangesAsync(ct);

            // النشر الآن: داخل نفس الطلب حتى يرى التاجر النتيجة فوراً
            if (!scheduledAt.HasValue || scheduledAt.Value <= Now)
                await ProcessAsync(post.Id, ct);

            return await GetDtoAsync(post.Id, ct);
        }

        public async Task<List<InstagramPostDto>> ListAsync(Guid userId, CancellationToken ct = default)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            var posts = await _context.Set<InstagramPost>().AsNoTracking()
                .Include(p => p.Product)
                .Where(p => p.VendorId == vendorId)
                .OrderByDescending(p => p.CreatedAt)
                .Take(50)
                .ToListAsync(ct);
            return posts.Select(Map).ToList();
        }

        public async Task<InstagramPostDto> CancelAsync(Guid userId, Guid postId, CancellationToken ct = default)
        {
            var post = await GetOwnedPostAsync(userId, postId, ct);
            if (post.Status != InstagramPost.StatusScheduled)
                throw new BusinessRuleException("يمكن إلغاء المنشورات المجدولة فقط");
            post.Status = InstagramPost.StatusCancelled;
            await _context.SaveChangesAsync(ct);
            _images.Delete(ReadList(post.PreparedImagesJson));
            return await GetDtoAsync(post.Id, ct);
        }

        public async Task<InstagramPostDto> RetryAsync(Guid userId, Guid postId, CancellationToken ct = default)
        {
            var post = await GetOwnedPostAsync(userId, postId, ct);
            if (post.Status != InstagramPost.StatusFailed)
                throw new BusinessRuleException("يمكن إعادة المحاولة للمنشورات التي فشلت فقط");
            post.Status = InstagramPost.StatusScheduled;
            post.ScheduledAt = Now;
            post.Attempts = 0;
            post.NextAttemptAt = null;
            post.Error = null;
            await _context.SaveChangesAsync(ct);
            await ProcessAsync(post.Id, ct);
            return await GetDtoAsync(post.Id, ct);
        }

        // ===================================
        // الخلفية
        // ===================================
        public async Task<int> ProcessDueAsync(CancellationToken ct = default)
        {
            var now = Now;

            // منشور علق في «جارٍ النشر» (توقف الخادم مثلاً) يعود للجدولة — حالة الحاوية تمنع نشره مرتين
            var stuck = await _context.Set<InstagramPost>()
                .Where(p => p.Status == InstagramPost.StatusPublishing && p.UpdatedAt < now - StuckPublishing)
                .ToListAsync(ct);
            foreach (var p in stuck.Where(p => !PostLocks.ContainsKey(p.Id)))
                p.Status = InstagramPost.StatusScheduled;
            if (stuck.Count > 0) await _context.SaveChangesAsync(ct);

            if (now - _lastUploadCleanup > UploadCleanupInterval)
            {
                _lastUploadCleanup = now;
                await CleanupUploadsAsync(now, ct);
            }

            // صور مجهزة بقيت لمنشورات فشلت ولم يُعَد نشرها خلال يوم
            var leftovers = await _context.Set<InstagramPost>()
                .Where(p => p.PreparedImagesJson != null && p.Status == InstagramPost.StatusFailed && p.UpdatedAt < now.AddDays(-1))
                .ToListAsync(ct);
            foreach (var p in leftovers)
            {
                _images.Delete(ReadList(p.PreparedImagesJson));
                p.PreparedImagesJson = null;
            }
            if (leftovers.Count > 0) await _context.SaveChangesAsync(ct);

            var due = await _context.Set<InstagramPost>().AsNoTracking()
                .Where(p => p.Status == InstagramPost.StatusScheduled && p.ScheduledAt <= now &&
                            (p.NextAttemptAt == null || p.NextAttemptAt <= now))
                .OrderBy(p => p.ScheduledAt)
                .Select(p => p.Id)
                .Take(10)
                .ToListAsync(ct);

            foreach (var id in due)
                await ProcessAsync(id, ct);
            return due.Count;
        }

        // ===================================
        // تنفيذ النشر
        // ===================================
        private async Task ProcessAsync(Guid postId, CancellationToken ct)
        {
            var gate = PostLocks.GetOrAdd(postId, _ => new SemaphoreSlim(1, 1));
            if (!await gate.WaitAsync(0, ct)) return;   // يُنشر الآن في طلب آخر
            try
            {
                await PublishLockedAsync(postId, ct);
            }
            finally
            {
                gate.Release();
                PostLocks.TryRemove(postId, out _);
            }
        }

        private async Task PublishLockedAsync(Guid postId, CancellationToken ct)
        {
            var post = await _context.Set<InstagramPost>().FirstOrDefaultAsync(p => p.Id == postId, ct);
            if (post == null) return;
            await _context.Entry(post).ReloadAsync(ct);   // أحدث حالة من القاعدة
            var now = Now;
            if (post.Status != InstagramPost.StatusScheduled || post.NextAttemptAt > now) return;

            post.Status = InstagramPost.StatusPublishing;
            post.Attempts++;
            await _context.SaveChangesAsync(ct);

            try
            {
                var session = await _instagram.GetPublishSessionAsync(post.VendorId, ct);
                if (!session.CanPublish)
                {
                    Fail(post, "صلاحية النشر غير ممنوحة — أعد ربط حساب إنستغرام ووافق على النشر");
                    return;
                }

                // محاولة سابقة أنشأت حاوية: إن كانت نُشرت فعلاً لا نعيد النشر
                if (!string.IsNullOrEmpty(post.ContainerId))
                {
                    var previous = await _api.GetContainerStatusAsync(session.AccessToken, post.ContainerId, ct);
                    if (previous == "PUBLISHED")
                    {
                        post.Status = InstagramPost.StatusPublished;
                        post.PublishedAt ??= Now;
                        post.Error = null;
                        post.NextAttemptAt = null;
                        _images.Delete(ReadList(post.PreparedImagesJson));
                        post.PreparedImagesJson = null;
                        return;
                    }
                    if (previous is "EXPIRED" or "ERROR") post.ContainerId = null;
                }

                var limit = await _api.GetPublishingLimitAsync(session.AccessToken, session.IgUserId, ct);
                if (limit?.Config is { QuotaTotal: > 0 } config && limit.QuotaUsage >= config.QuotaTotal)
                {
                    Reschedule(post, TimeSpan.FromHours(1), $"بلغ الحساب حد النشر اليومي من إنستغرام ({config.QuotaTotal} منشور خلال 24 ساعة) — سيُعاد المحاولة لاحقاً");
                    return;
                }

                if (string.IsNullOrEmpty(post.ContainerId))
                {
                    // الصور تُجهَّز (JPEG مربع)، والفيديو يُرسل كما رُفع (إنستغرام يقبل MP4/MOV)
                    var prepared = ReadList(post.PreparedImagesJson);
                    if (prepared.Count == 0)
                    {
                        foreach (var source in ReadList(post.SourceImagesJson))
                            prepared.Add(SocialMediaStore.IsVideo(source) ? source : await _images.PrepareAsync(source, ct));
                        post.PreparedImagesJson = JsonSerializer.Serialize(prepared);
                        await _context.SaveChangesAsync(ct);
                    }

                    if (prepared.Count == 1)
                    {
                        var url = PublicUrl(prepared[0]);
                        post.ContainerId = SocialMediaStore.IsVideo(url)
                            ? await _api.CreateVideoContainerAsync(session.AccessToken, session.IgUserId, url, post.Caption, false, ct)
                            : await _api.CreateImageContainerAsync(session.AccessToken, session.IgUserId, url, post.Caption, false, ct);
                    }
                    else
                    {
                        var children = new List<string>();
                        foreach (var url in prepared.Select(PublicUrl))
                            children.Add(SocialMediaStore.IsVideo(url)
                                ? await _api.CreateVideoContainerAsync(session.AccessToken, session.IgUserId, url, null, true, ct)
                                : await _api.CreateImageContainerAsync(session.AccessToken, session.IgUserId, url, null, true, ct));
                        post.ContainerId = await _api.CreateCarouselContainerAsync(session.AccessToken, session.IgUserId, children, post.Caption, ct);
                    }
                    await _context.SaveChangesAsync(ct);
                }

                // الصور جاهزة عادةً فوراً (ننتظر حتى ~30 ثانية)، والفيديو يحتاج وقتاً أطول (حتى ~60 ثانية)
                var hasVideo = ReadList(post.SourceImagesJson).Any(SocialMediaStore.IsVideo);
                string? status = null;
                for (var i = 0; i < (hasVideo ? 30 : 15); i++)
                {
                    status = await _api.GetContainerStatusAsync(session.AccessToken, post.ContainerId!, ct);
                    if (status is "FINISHED" or "ERROR" or "EXPIRED" or "PUBLISHED") break;
                    await Task.Delay(TimeSpan.FromSeconds(_options.PublishPollIntervalSeconds), ct);
                }
                if (status == "ERROR" || status == "EXPIRED")
                {
                    post.ContainerId = null;
                    Fail(post, hasVideo
                        ? "رفض إنستغرام معالجة الفيديو — تأكد أنه MP4 أو MOV، بين 3 ثوانٍ و15 دقيقة (وحتى 60 ثانية داخل الألبوم)"
                        : "رفض إنستغرام معالجة الصور — جرّب صوراً أخرى");
                    return;
                }
                if (status != "FINISHED" && status != "PUBLISHED")
                {
                    if (post.Attempts >= MaxProcessingChecks)
                    {
                        post.ContainerId = null;
                        Fail(post, "استغرق إنستغرام وقتاً طويلاً في معالجة الوسائط — جرّب مرة أخرى أو استخدم فيديو أقصر");
                        return;
                    }
                    Reschedule(post, TimeSpan.FromMinutes(2), hasVideo
                        ? "إنستغرام يعالج الفيديو — سيُنشر تلقائياً خلال دقائق"
                        : "إنستغرام ما زال يعالج الصور — سيُعاد المحاولة تلقائياً");
                    return;
                }

                if (status != "PUBLISHED")
                {
                    post.ExternalMediaId = await _api.PublishContainerAsync(session.AccessToken, session.IgUserId, post.ContainerId!, ct);
                }
                post.Status = InstagramPost.StatusPublished;
                post.PublishedAt = Now;
                post.Error = null;
                post.NextAttemptAt = null;
                await _context.SaveChangesAsync(ct);

                if (post.ExternalMediaId != null)
                {
                    try
                    {
                        post.Permalink = await _api.GetPermalinkAsync(session.AccessToken, post.ExternalMediaId, ct);
                        var sources = ReadList(post.SourceImagesJson);
                        var mediaType = sources.Count > 1 ? InstagramMedia.TypeCarousel
                            : SocialMediaStore.IsVideo(sources[0]) ? InstagramMedia.TypeVideo : InstagramMedia.TypeImage;
                        await _instagram.RecordPublishedMediaAsync(post.VendorId, post.ExternalMediaId, post.ProductId, post.Caption,
                            sources.FirstOrDefault(), mediaType, ct);
                    }
                    catch (Exception ex) when (ex is InstagramApiException or HttpRequestException)
                    {
                        // المنشور نُشر فعلاً — الرابط والربط بالمنتج تكملهما المزامنة الدورية
                        _logger.LogWarning("Instagram post {PostId} published but follow-up failed: {Error}", post.Id, ex.Message);
                    }
                }

                _images.Delete(ReadList(post.PreparedImagesJson));
                post.PreparedImagesJson = null;
            }
            catch (InstagramApiException ex)
            {
                if (ex.RequiresReconnect)
                    Fail(post, "انتهت صلاحية الربط أو سُحب الإذن — أعد ربط حساب إنستغرام");
                else if (IsTransient(ex) && post.Attempts < MaxAttempts)
                    Reschedule(post, TimeSpan.FromMinutes(2 * post.Attempts), "تعذّر الاتصال بإنستغرام — سيُعاد المحاولة تلقائياً");
                else
                    Fail(post, string.IsNullOrWhiteSpace(ex.Detail) ? "رفض إنستغرام نشر المنشور" : $"رفض إنستغرام النشر: {ex.Detail}");
                _logger.LogWarning("Instagram publish {PostId} failed: {Code} {Detail}", post.Id, ex.Code, ex.Detail);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                if (post.Attempts < MaxAttempts)
                    Reschedule(post, TimeSpan.FromMinutes(2 * post.Attempts), "تعذّر الاتصال بإنستغرام — سيُعاد المحاولة تلقائياً");
                else
                    Fail(post, "تعذّر الاتصال بإنستغرام");
            }
            catch (Exception ex) when (ex is FileNotFoundException or InvalidOperationException or BusinessRuleException or NotFoundException)
            {
                Fail(post, ex.Message);
            }
            finally
            {
                await _context.SaveChangesAsync(CancellationToken.None);
            }
        }

        // المرفوعات التي يستخدمها منشور حديث أو لم يُحسم بعد تبقى؛ غيرها يُحذف بعد يوم من رفعه
        private async Task CleanupUploadsAsync(DateTime now, CancellationToken ct)
        {
            var recent = now.AddDays(-35);
            var inUse = await _context.Set<InstagramPost>().AsNoTracking()
                .Where(p => p.CreatedAt > recent || p.Status == InstagramPost.StatusScheduled ||
                            p.Status == InstagramPost.StatusPublishing || p.Status == InstagramPost.StatusFailed)
                .Select(p => p.SourceImagesJson)
                .ToListAsync(ct);
            // ملفات منشورات تيك توك (المجدولة خصوصاً) لا تُحذف أيضاً
            var tikTokInUse = await _context.Set<TikTokPost>().AsNoTracking()
                .Where(p => p.CreatedAt > recent || p.Status == TikTokPost.StatusScheduled ||
                            p.Status == TikTokPost.StatusPublishing || p.Status == TikTokPost.StatusFailed)
                .Select(p => p.SourceMediaJson)
                .ToListAsync(ct);
            var keep = inUse.Concat(tikTokInUse).SelectMany(ReadList).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var removed = _uploads.CleanupUnused(keep, now.AddDays(-1));
            if (removed > 0) _logger.LogInformation("Removed {Count} unused social upload(s)", removed);
        }

        // 1/2: خطأ مؤقت من Meta، 4/17/32/613: تجاوز حد الطلبات، 9007: الوسائط غير جاهزة، 5xx: خطأ خادم
        private static bool IsTransient(InstagramApiException ex) =>
            ex.Code is "1" or "2" or "4" or "17" or "32" or "613" or "9007" or "network"
            || (int.TryParse(ex.Code, out var http) && http >= 500);

        private void Fail(InstagramPost post, string message)
        {
            post.Status = InstagramPost.StatusFailed;
            post.Error = message.Length > 500 ? message[..500] : message;
            post.NextAttemptAt = null;
        }

        private void Reschedule(InstagramPost post, TimeSpan delay, string message)
        {
            post.Status = InstagramPost.StatusScheduled;
            post.NextAttemptAt = Now + delay;
            post.Error = message;
        }

        // ===================================
        // Helpers
        // ===================================
        public static void ValidateCaption(string caption)
        {
            if (caption.Length == 0)
                throw new BusinessRuleException("اكتب نص المنشور");
            if (caption.Length > 2200)
                throw new BusinessRuleException("نص المنشور أطول من 2200 حرف (حد إنستغرام)");
            if (Regex.Matches(caption, @"#[\p{L}\p{N}_]+").Count > MaxHashtags)
                throw new BusinessRuleException($"إنستغرام يقبل {MaxHashtags} وسماً (#) كحد أقصى");
            if (Regex.Matches(caption, @"@[\w.]+").Count > MaxMentions)
                throw new BusinessRuleException($"إنستغرام يقبل {MaxMentions} إشارة (@) كحد أقصى");
        }

        public static string BuildCaption(Product product)
        {
            var lines = new List<string> { product.NameAr ?? product.Name };
            if (!string.IsNullOrWhiteSpace(product.Description) && product.Description.Trim() != "-")
                lines.Add(product.Description.Trim());
            lines.Add("");
            lines.Add($"💰 السعر: {product.Price:N0} د.ع");
            var store = product.Vendor?.NameAr ?? product.Vendor?.Name;
            lines.Add(store != null ? $"🛍️ اطلبه الآن من «{store}» على منصة واسط" : "🛍️ اطلبه الآن على منصة واسط");
            var tags = new List<string> { "#واسط", "#تسوق_اونلاين" };
            var category = product.Category?.NameAr;
            if (!string.IsNullOrWhiteSpace(category)) tags.Add("#" + Regex.Replace(category.Trim(), @"\s+", "_"));
            lines.Add("");
            lines.Add(string.Join(' ', tags));
            return string.Join('\n', lines);
        }

        private static List<string> ProductImages(Product product) =>
            product.Images
                .OrderByDescending(i => i.IsPrimary).ThenBy(i => i.DisplayOrder)
                .Select(i => i.ImageUrl)
                .Where(u => !string.IsNullOrWhiteSpace(u))
                .ToList();

        private string PublicUrl(string relative) => _options.PublicBaseUrl.TrimEnd('/') + relative;

        private async Task<Product> LoadProductAsync(Guid vendorId, Guid productId, CancellationToken ct) =>
            await _context.Products.AsNoTracking()
                .Include(p => p.Images).Include(p => p.Vendor).Include(p => p.Category)
                .FirstOrDefaultAsync(p => p.Id == productId && p.VendorId == vendorId && !p.IsDeleted, ct)
            ?? throw new NotFoundException("المنتج غير موجود في متجرك");

        private async Task<Guid> GetVendorIdAsync(Guid userId, CancellationToken ct) =>
            await ecommerce.Core.Constants.VendorMembership.VendorIdOfAsync(_context, userId, ct)
            ?? throw new ForbiddenException("هذا الحساب غير مرتبط بمتجر");

        private async Task<InstagramPost> GetOwnedPostAsync(Guid userId, Guid postId, CancellationToken ct)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            return await _context.Set<InstagramPost>().FirstOrDefaultAsync(p => p.Id == postId && p.VendorId == vendorId, ct)
                ?? throw new NotFoundException("المنشور غير موجود");
        }

        private async Task<InstagramPostDto> GetDtoAsync(Guid postId, CancellationToken ct) =>
            Map(await _context.Set<InstagramPost>().AsNoTracking().Include(p => p.Product).FirstAsync(p => p.Id == postId, ct));

        private static List<string> ReadList(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new List<string>();
            try { return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>(); }
            catch (JsonException) { return new List<string>(); }
        }

        private static InstagramPostDto Map(InstagramPost p) => new()
        {
            Id = p.Id,
            ProductId = p.ProductId,
            ProductName = p.Product?.NameAr ?? p.Product?.Name,
            Caption = p.Caption,
            Images = ReadList(p.SourceImagesJson),
            Status = p.Status,
            ScheduledAt = p.ScheduledAt,
            PublishedAt = p.PublishedAt,
            Permalink = p.Permalink,
            Error = p.Error,
            CreatedAt = p.CreatedAt
        };
    }
}
