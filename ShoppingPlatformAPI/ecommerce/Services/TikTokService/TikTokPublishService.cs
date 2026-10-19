using System.Collections.Concurrent;
using System.Text.Json;
using ecommerce.Core.DTO.TikTok;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.InstagramService;
using ecommerce.Services.SocialPublishService;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.TikTokService
{
    // نشر منتجات التاجر على حساب تيك توك المربوط بمتجره (Content Posting API — Direct Post، صلاحية video.publish).
    // التاجر يختار الوسائط والنص والخصوصية ويضغط «نشر» بنفسه — لا نشر تلقائي ولا جدولة.
    // الخطوات: creator_info (خيارات الحساب) ← init (تيك توك يسحب الوسائط من رابطنا العام: PULL_FROM_URL) ← متابعة الحالة.
    // منشور فيديو (ملف واحد) أو منشور صور (حتى 35) — تيك توك لا يقبل الخلط بينهما
    public interface ITikTokPublishService
    {
        Task<TikTokPublishOptionsDto> GetOptionsAsync(Guid userId, Guid productId, CancellationToken ct = default);
        Task<TikTokPostDto> CreateAsync(Guid userId, CreateTikTokPostDto dto, CancellationToken ct = default);
        Task<List<TikTokPostDto>> ListAsync(Guid userId, CancellationToken ct = default);
        Task<TikTokPostDto> RetryAsync(Guid userId, Guid postId, CancellationToken ct = default);

        // الخلفية: متابعة المنشورات قيد المعالجة عند تيك توك
        Task<int> ProcessPendingAsync(CancellationToken ct = default);
    }

    public class TikTokPublishService : ITikTokPublishService
    {
        public const int MaxImages = 35;
        private static readonly string[] PrivacyLevels =
            { "PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY" };

        private static readonly TimeSpan PendingTimeout = TimeSpan.FromMinutes(30);
        private static readonly TimeSpan NoPublishIdTimeout = TimeSpan.FromMinutes(5);
        // نتابع الحالة داخل الطلب نفسه (حتى ~30 ثانية) ليرى التاجر النتيجة، وإلا تكمل الخلفية
        private const int InlinePolls = 10;
        private static readonly TimeSpan InlinePollDelay = TimeSpan.FromSeconds(3);

        // الخادم عملية واحدة (الخلفية + طلبات التاجر): قفل لكل منشور يمنع معالجته معاً
        private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> PostLocks = new();

        private readonly AppDbContext _context;
        private readonly ITikTokService _tikTok;
        private readonly ITikTokApiClient _api;
        private readonly IInstagramImagePreparer _images;
        private readonly ISocialMediaStore _uploads;
        private readonly TikTokOptions _options;
        private readonly TimeProvider _time;
        private readonly ILogger<TikTokPublishService> _logger;

        public TikTokPublishService(AppDbContext context, ITikTokService tikTok, ITikTokApiClient api,
            IInstagramImagePreparer images, ISocialMediaStore uploads, IOptions<TikTokOptions> options,
            TimeProvider time, ILogger<TikTokPublishService> logger)
        {
            _context = context;
            _tikTok = tikTok;
            _api = api;
            _images = images;
            _uploads = uploads;
            _options = options.Value;
            _time = time;
            _logger = logger;
        }

        private DateTime Now => _time.GetUtcNow().UtcDateTime;
        private bool PublishingEnabled => _options.IsConfigured && !string.IsNullOrWhiteSpace(_options.PublicBaseUrl);

        // ===================================
        // شاشة النشر
        // ===================================
        public async Task<TikTokPublishOptionsDto> GetOptionsAsync(Guid userId, Guid productId, CancellationToken ct = default)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            var product = await LoadProductAsync(vendorId, productId, ct);
            var connection = await _context.Set<TikTokConnection>().AsNoTracking().FirstOrDefaultAsync(c => c.VendorId == vendorId, ct);

            var dto = new TikTokPublishOptionsDto
            {
                PublishingEnabled = PublishingEnabled,
                Connected = connection != null,
                NeedsReconnect = connection?.NeedsReconnect ?? false,
                Username = connection?.Username,
                Nickname = connection?.DisplayName,
                AvatarUrl = connection?.AvatarUrl,
                ProductId = product.Id,
                ProductName = product.NameAr ?? product.Name,
                StoreName = product.Vendor?.NameAr ?? product.Vendor?.Name,
                Images = ProductImages(product),
                SuggestedCaption = BuildCaption(product)
            };

            if (connection != null && !connection.NeedsReconnect && PublishingEnabled)
            {
                try
                {
                    var session = await _tikTok.GetPublishSessionAsync(vendorId, ct);
                    dto.CanPublish = session.CanPublish;
                    if (session.CanPublish)
                    {
                        var info = await _api.QueryCreatorInfoAsync(session.AccessToken, ct);
                        dto.Nickname = info.Nickname ?? dto.Nickname;
                        dto.Username = info.Username ?? dto.Username;
                        dto.PrivacyOptions = info.PrivacyLevelOptions ?? new List<string>();
                        dto.CommentDisabled = info.CommentDisabled;
                        dto.DuetDisabled = info.DuetDisabled;
                        dto.StitchDisabled = info.StitchDisabled;
                        dto.MaxVideoDurationSeconds = info.MaxVideoDurationSeconds;
                    }
                }
                catch (TikTokApiException ex)
                {
                    dto.NeedsReconnect = ex.RequiresReconnect;
                    _logger.LogInformation("TikTok publish options: {Code}", ex.Code);
                }
            }
            return dto;
        }

        // ===================================
        // إنشاء منشور (الآن)
        // ===================================
        public async Task<TikTokPostDto> CreateAsync(Guid userId, CreateTikTokPostDto dto, CancellationToken ct = default)
        {
            if (!PublishingEnabled)
                throw new BusinessRuleException("النشر على تيك توك غير مفعّل على المنصة بعد");
            if (!dto.Consent)
                throw new BusinessRuleException("يجب الموافقة على نشر المحتوى على حسابك في تيك توك");

            var vendorId = await GetVendorIdAsync(userId, ct);
            var product = await LoadProductAsync(vendorId, dto.ProductId, ct);

            var caption = (dto.Caption ?? "").Trim();
            if (caption.Length == 0)
                throw new BusinessRuleException("اكتب نص المنشور");
            if (caption.Length > 2200)
                throw new BusinessRuleException("نص المنشور أطول من 2200 حرف");

            // صور المنتج نفسه، أو ما رفعه هذا المتجر من الاستوديو — لا مسارات عشوائية
            var allowed = ProductImages(product);
            var media = dto.Media.Where(m => !string.IsNullOrWhiteSpace(m)).Distinct().ToList();
            if (media.Count == 0)
                throw new BusinessRuleException("اختر فيديو أو صوراً للنشر");
            if (media.Any(m => !allowed.Contains(m) && !_uploads.IsVendorUpload(vendorId, m)))
                throw new BusinessRuleException("أحد الملفات لا يخص هذا المنتج أو متجرك");

            var isVideo = media.Any(SocialMediaStore.IsVideo);
            if (isVideo && media.Count > 1)
                throw new BusinessRuleException("تيك توك يقبل فيديو واحداً في المنشور، أو صوراً فقط — لا خلط بينهما");
            if (!isVideo && media.Count > MaxImages)
                throw new BusinessRuleException($"تيك توك يقبل {MaxImages} صورة كحد أقصى");

            if (!PrivacyLevels.Contains(dto.PrivacyLevel))
                throw new BusinessRuleException("اختر من يستطيع مشاهدة المنشور");

            var session = await _tikTok.GetPublishSessionAsync(vendorId, ct);
            if (!session.CanPublish)
                throw new BusinessRuleException("أعد ربط حساب تيك توك ووافق على صلاحية النشر");

            // الخصوصية وخيارات التفاعل يحددها تيك توك لكل حساب — لا نرسل ما لا يسمح به
            var info = await _api.QueryCreatorInfoAsync(session.AccessToken, ct);
            if (info.PrivacyLevelOptions is { Count: > 0 } options && !options.Contains(dto.PrivacyLevel))
                throw new BusinessRuleException("خيار الخصوصية غير متاح لحسابك في تيك توك الآن");

            var post = new TikTokPost
            {
                VendorId = vendorId,
                ProductId = product.Id,
                CreatedByUserId = userId,
                Caption = caption,
                SourceMediaJson = JsonSerializer.Serialize(media),
                IsVideo = isVideo,
                PrivacyLevel = dto.PrivacyLevel,
                AllowComment = dto.AllowComment && !info.CommentDisabled,
                AllowDuet = isVideo && dto.AllowDuet && !info.DuetDisabled,
                AllowStitch = isVideo && dto.AllowStitch && !info.StitchDisabled,
                PromotesOwnBusiness = dto.PromotesOwnBusiness,
                Status = TikTokPost.StatusPublishing
            };
            _context.Add(post);
            await _context.SaveChangesAsync(ct);

            await ProcessAsync(post.Id, ct);
            return await GetDtoAsync(post.Id, ct);
        }

        public async Task<List<TikTokPostDto>> ListAsync(Guid userId, CancellationToken ct = default)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            var posts = await _context.Set<TikTokPost>().AsNoTracking()
                .Include(p => p.Product)
                .Where(p => p.VendorId == vendorId)
                .OrderByDescending(p => p.CreatedAt)
                .Take(50)
                .ToListAsync(ct);
            return posts.Select(Map).ToList();
        }

        public async Task<TikTokPostDto> RetryAsync(Guid userId, Guid postId, CancellationToken ct = default)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            var post = await _context.Set<TikTokPost>().FirstOrDefaultAsync(p => p.Id == postId && p.VendorId == vendorId, ct)
                ?? throw new NotFoundException("المنشور غير موجود");
            if (post.Status != TikTokPost.StatusFailed)
                throw new BusinessRuleException("يمكن إعادة المحاولة للمنشورات التي فشلت فقط");

            post.Status = TikTokPost.StatusPublishing;
            post.PublishId = null;
            post.Attempts = 0;
            post.Error = null;
            await _context.SaveChangesAsync(ct);
            await ProcessAsync(post.Id, ct);
            return await GetDtoAsync(post.Id, ct);
        }

        // ===================================
        // الخلفية
        // ===================================
        public async Task<int> ProcessPendingAsync(CancellationToken ct = default)
        {
            var now = Now;
            var pending = await _context.Set<TikTokPost>().AsNoTracking()
                .Where(p => p.Status == TikTokPost.StatusPublishing)
                .OrderBy(p => p.CreatedAt)
                .Select(p => new { p.Id, p.PublishId, p.CreatedAt, p.UpdatedAt })
                .Take(20)
                .ToListAsync(ct);

            var handled = 0;
            foreach (var p in pending)
            {
                // طلب التاجر ما زال يتابعه
                if (PostLocks.ContainsKey(p.Id)) continue;
                // لم يصل إلى init (توقف الخادم مثلاً): لا نعيد الإنشاء تلقائياً كي لا يُنشر مرتين
                if (p.PublishId == null && (p.UpdatedAt ?? p.CreatedAt) < now - NoPublishIdTimeout)
                {
                    await FailStaleAsync(p.Id, "تعذّر بدء النشر على تيك توك — أعد المحاولة", ct);
                    handled++;
                }
                else if (p.PublishId != null)
                {
                    await ProcessAsync(p.Id, ct);
                    handled++;
                }
            }
            return handled;
        }

        private async Task FailStaleAsync(Guid postId, string message, CancellationToken ct)
        {
            var post = await _context.Set<TikTokPost>().FirstOrDefaultAsync(p => p.Id == postId, ct);
            if (post is not { Status: TikTokPost.StatusPublishing, PublishId: null }) return;
            Fail(post, message);
            await _context.SaveChangesAsync(ct);
        }

        // ===================================
        // تنفيذ النشر ومتابعته
        // ===================================
        private async Task ProcessAsync(Guid postId, CancellationToken ct)
        {
            var gate = PostLocks.GetOrAdd(postId, _ => new SemaphoreSlim(1, 1));
            if (!await gate.WaitAsync(0, ct)) return;   // يُعالَج الآن في طلب آخر
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
            var post = await _context.Set<TikTokPost>().FirstOrDefaultAsync(p => p.Id == postId, ct);
            if (post == null) return;
            await _context.Entry(post).ReloadAsync(ct);   // أحدث حالة من القاعدة
            if (post.Status != TikTokPost.StatusPublishing) return;

            try
            {
                var session = await _tikTok.GetPublishSessionAsync(post.VendorId, ct);
                if (!session.CanPublish)
                {
                    Fail(post, "صلاحية النشر غير ممنوحة — أعد ربط حساب تيك توك ووافق على النشر");
                    return;
                }

                // الخطوة 1: إنشاء المنشور (مرة واحدة — بعدها نتابع بـ publish_id فقط)
                if (string.IsNullOrEmpty(post.PublishId))
                {
                    post.Attempts++;
                    await _context.SaveChangesAsync(ct);
                    post.PublishId = await InitAsync(post, session.AccessToken, ct);
                    await _context.SaveChangesAsync(ct);
                }

                // الخطوة 2: متابعة الحالة
                for (var i = 0; i < InlinePolls; i++)
                {
                    var status = await _api.FetchPublishStatusAsync(session.AccessToken, post.PublishId!, ct);
                    if (ApplyStatus(post, status)) break;
                    if (Now - post.CreatedAt > PendingTimeout)
                    {
                        Fail(post, "استغرق تيك توك وقتاً طويلاً في معالجة المنشور — أعد المحاولة");
                        break;
                    }
                    await Task.Delay(InlinePollDelay, ct);
                }
            }
            catch (TikTokApiException ex)
            {
                if (ex.RequiresReconnect)
                    Fail(post, "انتهت صلاحية الربط أو سُحب الإذن — أعد ربط حساب تيك توك");
                else if (post.PublishId != null && IsTransient(ex))
                    _logger.LogInformation("TikTok publish {PostId} status check failed ({Code}) — will retry", post.Id, ex.Code);
                else
                    Fail(post, ExplainError(ex));
                _logger.LogWarning("TikTok publish {PostId} failed: {Code} {Detail}", post.Id, ex.Code, ex.Detail);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                // قبل init: قد يكون وصل لتيك توك — لا نعيد تلقائياً. بعده: الخلفية تتابع
                if (post.PublishId == null)
                    Fail(post, "تعذّر الاتصال بتيك توك — تحقق من حسابك ثم أعد المحاولة");
            }
            catch (Exception ex) when (ex is FileNotFoundException or InvalidOperationException or BusinessRuleException or NotFoundException)
            {
                Fail(post, ex.Message);
            }
            finally
            {
                await _context.SaveChangesAsync(CancellationToken.None);
            }

            if (post.Status == TikTokPost.StatusPublished)
                await AfterPublishedAsync(post, ct);
        }

        private async Task<string> InitAsync(TikTokPost post, string accessToken, CancellationToken ct)
        {
            var settings = new TikTokPostSettings(post.PrivacyLevel, post.AllowComment, post.AllowDuet, post.AllowStitch, post.PromotesOwnBusiness);
            var sources = ReadList(post.SourceMediaJson);

            if (post.IsVideo)
                return await _api.InitVideoPostAsync(accessToken, post.Caption, PublicUrl(sources[0]), settings, ct);

            // الصور تُجهَّز (JPEG) — تيك توك لا يقبل PNG
            var prepared = ReadList(post.PreparedImagesJson);
            if (prepared.Count == 0)
            {
                foreach (var source in sources)
                    prepared.Add(await _images.PrepareAsync(source, ct));
                post.PreparedImagesJson = JsonSerializer.Serialize(prepared);
                await _context.SaveChangesAsync(ct);
            }

            // عنوان المنشور حتى 90 حرفاً (أول سطر)، والوصف كامل النص
            var firstLine = post.Caption.Split('\n')[0].Trim();
            var title = firstLine.Length > 90 ? firstLine[..90] : firstLine;
            return await _api.InitPhotoPostAsync(accessToken, title, post.Caption, prepared.Select(PublicUrl).ToList(), settings, ct);
        }

        // true = انتهت المتابعة (نُشر أو فشل)
        private bool ApplyStatus(TikTokPost post, TikTokPublishStatus status)
        {
            switch (status.Status)
            {
                case "PUBLISH_COMPLETE":
                    post.Status = TikTokPost.StatusPublished;
                    post.PublishedAt = Now;
                    post.Error = null;
                    post.ExternalVideoId = status.PostIds is { Count: > 0 } ? status.PostIds[0].ToString() : null;
                    return true;
                case "FAILED":
                    Fail(post, ExplainFailReason(status.FailReason));
                    return true;
                default:
                    return false;   // PROCESSING_DOWNLOAD / PROCESSING_UPLOAD / SEND_TO_USER_INBOX
            }
        }

        private async Task AfterPublishedAsync(TikTokPost post, CancellationToken ct)
        {
            try
            {
                if (!string.IsNullOrEmpty(post.ExternalVideoId))
                    await _tikTok.LinkPublishedVideoAsync(post.VendorId, post.ExternalVideoId, post.ProductId, ct);
            }
            catch (Exception ex) when (ex is TikTokApiException or HttpRequestException)
            {
                // المنشور نُشر فعلاً — الربط بالمنتج تكمله المزامنة الدورية
                _logger.LogWarning("TikTok post {PostId} published but follow-up failed: {Error}", post.Id, ex.Message);
            }

            _images.Delete(ReadList(post.PreparedImagesJson));
            post.PreparedImagesJson = null;
            await _context.SaveChangesAsync(CancellationToken.None);
        }

        // 5xx / مهلة / تجاوز حد الطلبات: خطأ مؤقت لا يُفشل منشوراً تيك توك بدأ معالجته
        private static bool IsTransient(TikTokApiException ex) =>
            ex.Code is "rate_limit_exceeded" or "internal_error" or "service_unavailable";

        private void Fail(TikTokPost post, string message)
        {
            post.Status = TikTokPost.StatusFailed;
            post.Error = message.Length > 500 ? message[..500] : message;
            _images.Delete(ReadList(post.PreparedImagesJson));
            post.PreparedImagesJson = null;
        }

        // ===================================
        // رسائل الأخطاء للتاجر
        // ===================================
        private static string ExplainError(TikTokApiException ex) => ex.Code switch
        {
            "url_ownership_unverified" => "لم يتحقق تيك توك من ملكية نطاق المنصة — يلزم التحقق منه في لوحة مطوّري تيك توك",
            "unaudited_client_can_only_post_to_private_accounts" => "تطبيق المنصة لم يُعتمد من تيك توك بعد — يُنشر المحتوى بخصوصية «أنا فقط» حتى الاعتماد",
            "privacy_level_option_mismatch" => "خيار الخصوصية غير متاح لحسابك — اختر خياراً آخر",
            "spam_risk_too_many_posts" => "بلغ حسابك حد النشر اليومي في تيك توك — حاول لاحقاً",
            "spam_risk_user_banned_from_posting" => "تيك توك أوقف النشر على هذا الحساب مؤقتاً",
            "reached_active_user_cap" => "بلغ تطبيق المنصة الحد اليومي من المستخدمين في تيك توك — حاول لاحقاً",
            "invalid_file_format" => "صيغة الملف غير مقبولة في تيك توك — استخدم MP4 أو MOV",
            "duration_check_failed" => "مدة الفيديو غير مقبولة في تيك توك",
            "picture_size_check_failed" or "invalid_param" => "تعذّر قبول الوسائط في تيك توك — جرّب ملفات أخرى",
            "scope_not_authorized" => "صلاحية النشر غير ممنوحة — أعد ربط حساب تيك توك",
            "rate_limit_exceeded" => "تجاوز عدد الطلبات إلى تيك توك — حاول بعد قليل",
            _ => string.IsNullOrWhiteSpace(ex.Detail) ? "رفض تيك توك نشر المنشور" : $"رفض تيك توك النشر: {ex.Detail}"
        };

        private static string ExplainFailReason(string? reason) => reason switch
        {
            "file_format_check_failed" => "صيغة الملف غير مقبولة — استخدم MP4 أو MOV",
            "duration_check_failed" => "مدة الفيديو غير مقبولة في تيك توك",
            "frame_rate_check_failed" => "معدل إطارات الفيديو غير مقبول في تيك توك",
            "picture_size_check_failed" => "أبعاد الصور غير مقبولة في تيك توك",
            "internal" => "حدث خطأ داخلي في تيك توك — أعد المحاولة",
            "video_pull_failed" or "photo_pull_failed" => "تعذّر على تيك توك تحميل الوسائط من رابط المنصة — تأكد أن الرابط عام وأن النطاق متحقَّق منه",
            "publish_cancelled" => "أُلغي النشر في تيك توك",
            "auth_removed" => "سُحب إذن النشر — أعد ربط حساب تيك توك",
            "spam_risk_too_many_posts" => "بلغ حسابك حد النشر اليومي في تيك توك",
            _ => string.IsNullOrWhiteSpace(reason) ? "فشل نشر المنشور في تيك توك" : $"فشل النشر في تيك توك: {reason}"
        };

        // ===================================
        // Helpers
        // ===================================
        public static string BuildCaption(Product product) => InstagramPublishService.BuildCaption(product);

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

        private async Task<TikTokPostDto> GetDtoAsync(Guid postId, CancellationToken ct) =>
            Map(await _context.Set<TikTokPost>().AsNoTracking().Include(p => p.Product).FirstAsync(p => p.Id == postId, ct));

        private static List<string> ReadList(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new List<string>();
            try { return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>(); }
            catch (JsonException) { return new List<string>(); }
        }

        private static TikTokPostDto Map(TikTokPost p) => new()
        {
            Id = p.Id,
            ProductId = p.ProductId,
            ProductName = p.Product?.NameAr ?? p.Product?.Name,
            Caption = p.Caption,
            Media = ReadList(p.SourceMediaJson),
            IsVideo = p.IsVideo,
            PrivacyLevel = p.PrivacyLevel,
            Status = p.Status,
            PublishedAt = p.PublishedAt,
            Error = p.Error,
            CreatedAt = p.CreatedAt
        };
    }
}
