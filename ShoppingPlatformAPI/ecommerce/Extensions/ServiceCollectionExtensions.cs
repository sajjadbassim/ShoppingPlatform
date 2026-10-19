using ecommerce.Services.DriverTrackingService;
using ecommerce.Services.OpsReportService;
using ecommerce.Services.VendorAccessService;
using ecommerce.Core.Interfaces;
using ecommerce.Data;
using ecommerce.Data.Interceptors;
using ecommerce.Repositories;
using ecommerce.Services;
using ecommerce.Services.AdminService;
using ecommerce.Services.AuthService;
using ecommerce.Services.CurrentUserService;
using ecommerce.Services.FileService;
using ecommerce.Services.HomeService;
using ecommerce.Services.InventoryService;
using ecommerce.Services.InvoiceService;
using ecommerce.Services.LoyaltyService;
using ecommerce.Services.NotificationService;
using ecommerce.Services.OrderRatingService;
using ecommerce.Services.ProductService;
using ecommerce.Services.ProductService.ProductService;
using ecommerce.Services.SmsService;
using ecommerce.Services.TikTokService;
using ecommerce.Services.InstagramService;
using ecommerce.Services.FacebookService;
using ecommerce.Services.SocialFeedService;
using ecommerce.Core.Models;
using ecommerce.Services.UserPreferencesService;
using ecommerce.Services.VendorService.VendorService;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ecommerce.Extensions
{
    public static class ServiceCollectionExtensions
    {
        public static IServiceCollection AddAppPersistence(this IServiceCollection services, IConfiguration config)
        {
            services.AddSingleton<AuditableEntityInterceptor>();
            services.AddMemoryCache();
            services.AddSingleton<ecommerce.Services.AuthService.IUserSessionValidator, ecommerce.Services.AuthService.UserSessionValidator>();
            services.AddSingleton<UserSessionInterceptor>();
            services.AddHttpContextAccessor();
            services.AddSingleton<ActivityChangeInterceptor>();

            services.AddDbContext<AppDbContext>((sp, options) =>
                options.UseSqlServer(config.GetConnectionString("DefaultConnection"))
                       .AddInterceptors(
                           sp.GetRequiredService<AuditableEntityInterceptor>(),
                           sp.GetRequiredService<UserSessionInterceptor>(),
                           sp.GetRequiredService<ActivityChangeInterceptor>()));

            services.AddScoped<IUnitOfWork, UnitOfWork>();
            return services;
        }

        public static IServiceCollection AddAppServices(this IServiceCollection services)
        {
            services.AddHttpContextAccessor();
            services.AddScoped<ICurrentUserService, CurrentUserService>();
            services.AddScoped<ecommerce.Services.ActivityLogService.IActivityLogService, ecommerce.Services.ActivityLogService.ActivityLogService>();
            services.AddHostedService<ecommerce.Services.ActivityLogService.ActivityLogRetentionService>();
            services.AddScoped<ecommerce.Services.StaffService.IStaffService, ecommerce.Services.StaffService.StaffService>();
            services.AddScoped<IVendorAccessService, VendorAccessService>();
            services.AddScoped<IDriverTrackingService, DriverTrackingService>();
            services.AddScoped<ecommerce.Services.FinanceService.IFinanceService, ecommerce.Services.FinanceService.FinanceService>();
            services.AddMemoryCache();
            services.AddSingleton<ecommerce.Services.AuthService.IAuthThrottle, ecommerce.Services.AuthService.AuthThrottle>();
            services.AddOptions<ecommerce.Services.AuthService.GoogleOptions>().BindConfiguration(ecommerce.Services.AuthService.GoogleOptions.Section);
            services.AddSingleton<ecommerce.Services.AuthService.IGoogleTokenValidator, ecommerce.Services.AuthService.GoogleTokenValidator>();
            services.AddScoped<ecommerce.Services.AuthService.IGoogleAuthService, ecommerce.Services.AuthService.GoogleAuthService>();
            services.AddScoped<ecommerce.Services.OrderSettingsService.IOrderSettingsService, ecommerce.Services.OrderSettingsService.OrderSettingsService>();
            // تأخر تأكيد المتجر: إشعار واحد للمتجر والعمليات (بلا إلغاء تلقائي)
            services.AddScoped<ecommerce.Services.OrderSettingsService.IOverdueConfirmationNotifier, ecommerce.Services.OrderSettingsService.OverdueConfirmationNotifier>();
            services.AddHostedService<ecommerce.Services.OrderSettingsService.OverdueConfirmationBackgroundService>();
            services.AddScoped<ecommerce.Services.OrderTimingService.IOrderTimingService, ecommerce.Services.OrderTimingService.OrderTimingService>();
            services.AddScoped<ecommerce.Services.DeliverySlotService.IDeliverySlotService, ecommerce.Services.DeliverySlotService.DeliverySlotService>();

            // تنبيهات التوفر وتذكير السلة المتروكة (كل 5 دقائق)
            services.AddScoped<ecommerce.Services.EngagementService.ICustomerEngagementService, ecommerce.Services.EngagementService.CustomerEngagementService>();
            services.AddHostedService<ecommerce.Services.EngagementService.CustomerEngagementBackgroundService>();

            // إشعارات الدفع (Web Push): طابور + مرسل في الخلفية
            services.AddOptions<ecommerce.Services.PushService.PushOptions>().BindConfiguration(ecommerce.Services.PushService.PushOptions.Section);
            services.AddSingleton<ecommerce.Services.PushService.PushQueue>();
            services.AddSingleton<ecommerce.Services.PushService.IPushQueue>(sp => sp.GetRequiredService<ecommerce.Services.PushService.PushQueue>());
            services.AddHostedService<ecommerce.Services.PushService.PushSenderService>();
            services.AddScoped<ecommerce.Services.DriverAppService.IDriverAppService, ecommerce.Services.DriverAppService.DriverAppService>();
            services.AddScoped<INotificationLinkService, NotificationLinkService>();
            services.AddScoped<IOpsReportService, OpsReportService>();

            services.AddScoped<IUserRepository, UserRepository>();
            services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
            services.AddScoped<IUserService, UserService>();

            services.AddScoped<IAddressRepository, AddressRepository>();
            services.AddScoped<IAddressService, AddressService>();

            services.AddScoped<IVendorRepository, VendorRepository>();
            services.AddScoped<IVendorService, VendorService>();

            services.AddScoped<ICategoryRepository, CategoryRepository>();
            services.AddScoped<ICategoryService, CategoryService>();

            services.AddScoped<IProductRepository, ProductRepository>();
            services.AddScoped<IProductService, ProductService>();

            services.AddScoped<ICartRepository, CartRepository>();
            services.AddScoped<ICartService, CartService>();

            services.AddScoped<IOrderRepository, OrderRepository>();
            services.AddScoped<ISubOrderRepository, SubOrderRepository>();
            services.AddScoped<IOrderService, OrderService>();

            services.AddScoped<IOpsService, OpsService>();
            services.AddScoped<ecommerce.Services.ReturnTripService.IReturnTripService, ecommerce.Services.ReturnTripService.ReturnTripService>();

            services.AddScoped<IOrderStatusLogRepository, OrderStatusLogRepository>();

            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<IPhoneVerificationService, PhoneVerificationService>();
            services.AddScoped<IPasswordResetOtpRepository, PasswordResetOtpRepository>();

            services.AddScoped<INotificationRepository, NotificationRepository>();
            services.AddScoped<INotificationService, NotificationService>();

            services.AddScoped<IAdminService, AdminService>();

            services.AddScoped<IFileService, FileService>();
            services.AddSingleton<ImageVariants>();
            services.AddScoped<ecommerce.Services.IAvatarService, ecommerce.Services.AvatarService>();
            services.AddScoped<ecommerce.Services.IDeliveryZoneService, ecommerce.Services.DeliveryZoneService>();
            services.AddScoped<ecommerce.Services.IGooglePictureFetcher, ecommerce.Services.GooglePictureFetcher>();
            services.AddHttpClient("google-avatar", c => c.Timeout = TimeSpan.FromSeconds(5));
            services.AddScoped<IProductImageRepository, ProductImageRepository>();

            services.AddScoped<IWishlistRepository, WishlistRepository>();
            services.AddScoped<IWishlistService, WishlistService>();

            services.AddScoped<IDriverRepository, DriverRepository>();
            services.AddScoped<IDriverService, DriverService>();

            services.AddScoped<IReviewRepository, ReviewRepository>();
            services.AddScoped<IReviewService, ReviewService>();

            services.AddScoped<IReturnRepository, ReturnRepository>();
            services.AddScoped<IReturnService, ReturnService>();
            services.AddScoped<IReturnRestockService, ReturnRestockService>();

            services.AddScoped<ICouponRepository, CouponRepository>();
            services.AddScoped<ICouponService, CouponService>();

            services.AddScoped<IPromotionRepository, PromotionRepository>();
            services.AddScoped<IPromotionService, PromotionService>();

            services.AddScoped<IVendorDashboardService, VendorDashboardService>();
            services.AddScoped<IVendorMarketingService, VendorMarketingService>();

            services.AddScoped<IVariantService, VariantService>();

            services.AddScoped<IHomeService, HomeService>();

            services.AddScoped<ILoyaltyService, LoyaltyService>();

            services.AddScoped<IInvoiceService, InvoiceService>();

            services.AddScoped<IOrderRatingService, OrderRatingService>();

            services.AddScoped<IInventoryRepository, InventoryRepository>();
            services.AddScoped<IInventoryService, InventoryService>();

            services.AddScoped<IUserPreferencesRepository, UserPreferencesRepository>();
            services.AddScoped<IUserPreferencesService, UserPreferencesService>();

            return services;
        }

        // مفاتيح Data Protection (تشفّر توكنات تيك توك وإنستغرام في قاعدة البيانات) في مجلد ثابت.
        // بدونه قد تُحفظ المفاتيح في الذاكرة فقط (IIS بلا ملف مستخدم، الحاويات) فتضيع بإعادة التشغيل
        // ويُطلب من كل التجار إعادة الربط. المسار: DataProtection:KeysPath، أو App_Data/DataProtection-Keys.
        // نقل الخادم يتطلب نقل هذا المجلد معه (على ويندوز المفاتيح مشفّرة بـ DPAPI مرتبطة بالجهاز)
        public static IServiceCollection AddAppDataProtection(this IServiceCollection services, IConfiguration config, IHostEnvironment env)
        {
            var keysPath = config["DataProtection:KeysPath"];
            if (string.IsNullOrWhiteSpace(keysPath))
                keysPath = Path.Combine(env.ContentRootPath, "App_Data", "DataProtection-Keys");

            var builder = services.AddDataProtection()
                .SetApplicationName("WasitPlatform")
                .PersistKeysToFileSystem(new DirectoryInfo(keysPath));
            // على مستوى الجهاز لا المستخدم: يعمل مهما كان حساب الخدمة على نفس الخادم
            if (OperatingSystem.IsWindows())
                builder.ProtectKeysWithDpapi(protectToLocalMachine: true);

            return services;
        }

        // ربط متاجر التجار بتيك توك — المفاتيح من القسم "TikTok" (السر في user-secrets / متغيرات البيئة).
        // يُستدعى بعد AddAppDataProtection (تشفير التوكنات)
        // رمز التحقق عبر واتساب (Wevlix) — بلا مفتاح يُطبع الرمز في السجل (التطوير)
        public static IServiceCollection AddOtpSender(this IServiceCollection services, IConfiguration config)
        {
            var section = config.GetSection(WevlixOptions.SectionName);
            services.Configure<WevlixOptions>(section);
            if (section.Get<WevlixOptions>()?.Enabled == true)
            {
                services.AddHttpClient(WevlixOtpSender.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(10));
                services.AddSingleton<IOtpSender, WevlixOtpSender>();   // بلا تبعيات scoped — يرسل في الخلفية
            }
            else services.AddScoped<IOtpSender, ConsoleOtpSender>();
            return services;
        }

        public static IServiceCollection AddTikTokIntegration(this IServiceCollection services, IConfiguration config)
        {
            services.Configure<TikTokOptions>(config.GetSection(TikTokOptions.SectionName));
            // الوسائط تُسحب من نفس العنوان العام المستخدم لإنستغرام ما لم يُضبط عنوان خاص بتيك توك
            services.PostConfigure<TikTokOptions>(o =>
            {
                if (string.IsNullOrWhiteSpace(o.PublicBaseUrl))
                    o.PublicBaseUrl = config["Instagram:PublicBaseUrl"] ?? "";
            });

            // مهلة اتصال قصيرة (الشبكة إلى TikTok غير مستقرة أحياناً) — TikTokApiClient يعيد المحاولة مرة
            services.AddHttpClient(TikTokApiClient.HttpClientName, client => client.Timeout = TimeSpan.FromSeconds(15))
                .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
                {
                    ConnectTimeout = TimeSpan.FromSeconds(6),
                    // تجربة كل عناوين الخادم معاً — أحد عناوين TikTok قد لا يكون قابلاً للوصول
                    ConnectCallback = TikTokConnectionHelper.ConnectToFastestAsync,
                    PooledConnectionLifetime = TimeSpan.FromMinutes(5)
                });
            services.TryAddSingleton(TimeProvider.System);

            // تشفير توكنات تيك توك في قاعدة البيانات (Data Protection من AddAppDataProtection)
            services.AddSingleton<ITikTokTokenProtector, TikTokTokenProtector>();

            services.AddScoped<ITikTokApiClient, TikTokApiClient>();
            services.AddScoped<ITikTokRepository, TikTokRepository>();
            services.AddScoped<ITikTokService, TikTokService>();
            services.AddHostedService<TikTokSyncBackgroundService>();

            services.AddScoped<ITikTokPublishService, TikTokPublishService>();
            services.AddHostedService<TikTokPublishBackgroundService>();

            return services;
        }

        // ربط متاجر التجار بإنستغرام + المحتوى الموحّد (تيك توك وإنستغرام) للزوار.
        // يُستدعى بعد AddAppDataProtection (تشفير التوكنات)
        public static IServiceCollection AddInstagramIntegration(this IServiceCollection services, IConfiguration config)
        {
            services.Configure<InstagramOptions>(config.GetSection(InstagramOptions.SectionName));

            services.AddHttpClient(InstagramApiClient.HttpClientName, client => client.Timeout = TimeSpan.FromSeconds(15))
                .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
                {
                    ConnectTimeout = TimeSpan.FromSeconds(6),
                    ConnectCallback = TikTokConnectionHelper.ConnectToFastestAsync,
                    PooledConnectionLifetime = TimeSpan.FromMinutes(5)
                })
                // إنستغرام يضع access_token و client_secret في رابط الطلب — سجلات HttpClient تطبع الروابط
                .RemoveAllLoggers();
            services.TryAddSingleton(TimeProvider.System);

            services.AddSingleton<IInstagramTokenProtector, InstagramTokenProtector>();
            services.AddScoped<IInstagramApiClient, InstagramApiClient>();
            services.AddScoped<IInstagramRepository, InstagramRepository>();
            services.AddScoped<IInstagramService, InstagramService>();
            services.AddHostedService<InstagramSyncBackgroundService>();
            // النشر من المنصة على حساب التاجر
            services.AddSingleton<IInstagramImagePreparer, InstagramImagePreparer>();
            services.AddScoped<IInstagramPublishService, InstagramPublishService>();
            services.AddScoped<ecommerce.Services.SocialPublishService.ISocialMediaStore, ecommerce.Services.SocialPublishService.SocialMediaStore>();
            services.AddHostedService<InstagramPublishBackgroundService>();

            services.AddScoped<ISocialFeedService, SocialFeedService>();

            return services;
        }

        // ربط متاجر التجار بصفحات فيسبوك (تسجيل دخول فيسبوك للأعمال) — يُستدعى بعد AddAppDataProtection
        public static IServiceCollection AddFacebookIntegration(this IServiceCollection services, IConfiguration config)
        {
            services.Configure<FacebookOptions>(config.GetSection(FacebookOptions.SectionName));

            services.AddHttpClient(FacebookApiClient.HttpClientName, client => client.Timeout = TimeSpan.FromSeconds(20))
                .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
                {
                    ConnectTimeout = TimeSpan.FromSeconds(6),
                    ConnectCallback = TikTokConnectionHelper.ConnectToFastestAsync,
                    PooledConnectionLifetime = TimeSpan.FromMinutes(5)
                })
                // التوكنات ومفتاح التطبيق في رابط الطلب — سجلات HttpClient تطبع الروابط
                .RemoveAllLoggers();
            services.TryAddSingleton(TimeProvider.System);
            services.AddMemoryCache();

            services.AddSingleton<IFacebookTokenProtector, FacebookTokenProtector>();
            services.AddScoped<IFacebookApiClient, FacebookApiClient>();
            services.AddScoped<IFacebookRepository, FacebookRepository>();
            services.AddScoped<IFacebookService, FacebookService>();
            services.AddHostedService<FacebookSyncBackgroundService>();

            return services;
        }
    }
}
