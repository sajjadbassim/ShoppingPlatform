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

            services.AddDbContext<AppDbContext>((sp, options) =>
                options.UseSqlServer(config.GetConnectionString("DefaultConnection"))
                       .AddInterceptors(sp.GetRequiredService<AuditableEntityInterceptor>()));

            services.AddScoped<IUnitOfWork, UnitOfWork>();
            return services;
        }

        public static IServiceCollection AddAppServices(this IServiceCollection services)
        {
            services.AddHttpContextAccessor();
            services.AddScoped<ICurrentUserService, CurrentUserService>();
            services.AddScoped<IVendorAccessService, VendorAccessService>();
            services.AddScoped<IDriverTrackingService, DriverTrackingService>();
            services.AddScoped<ecommerce.Services.FinanceService.IFinanceService, ecommerce.Services.FinanceService.FinanceService>();
            services.AddMemoryCache();
            services.AddSingleton<ecommerce.Services.AuthService.IAuthThrottle, ecommerce.Services.AuthService.AuthThrottle>();
            services.AddOptions<ecommerce.Services.AuthService.GoogleOptions>().BindConfiguration(ecommerce.Services.AuthService.GoogleOptions.Section);
            services.AddSingleton<ecommerce.Services.AuthService.IGoogleTokenValidator, ecommerce.Services.AuthService.GoogleTokenValidator>();
            services.AddScoped<ecommerce.Services.AuthService.IGoogleAuthService, ecommerce.Services.AuthService.GoogleAuthService>();
            services.AddScoped<ecommerce.Services.OrderSettingsService.IOrderSettingsService, ecommerce.Services.OrderSettingsService.OrderSettingsService>();
            services.AddScoped<ecommerce.Services.OrderTimingService.IOrderTimingService, ecommerce.Services.OrderTimingService.OrderTimingService>();

            // إشعارات الدفع (Web Push): طابور + مرسل في الخلفية
            services.AddOptions<ecommerce.Services.PushService.PushOptions>().BindConfiguration(ecommerce.Services.PushService.PushOptions.Section);
            services.AddSingleton<ecommerce.Services.PushService.PushQueue>();
            services.AddSingleton<ecommerce.Services.PushService.IPushQueue>(sp => sp.GetRequiredService<ecommerce.Services.PushService.PushQueue>());
            services.AddHostedService<ecommerce.Services.PushService.PushSenderService>();
            services.AddScoped<ecommerce.Services.DriverAppService.IDriverAppService, ecommerce.Services.DriverAppService.DriverAppService>();
            services.AddScoped<INotificationLinkService, NotificationLinkService>();
            services.AddScoped<IOpsReportService, OpsReportService>();

            services.AddScoped<IUserRepository, UserRepository>();
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

            services.AddScoped<IOrderStatusLogRepository, OrderStatusLogRepository>();

            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<IPasswordResetOtpRepository, PasswordResetOtpRepository>();
            services.AddScoped<ISmsSender, ConsoleSmsSender>();

            services.AddScoped<INotificationRepository, NotificationRepository>();
            services.AddScoped<INotificationService, NotificationService>();

            services.AddScoped<IAdminService, AdminService>();

            services.AddScoped<IFileService, FileService>();
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

        // ربط متاجر التجار بتيك توك — المفاتيح من القسم "TikTok" (السر في user-secrets / متغيرات البيئة)
        public static IServiceCollection AddTikTokIntegration(this IServiceCollection services, IConfiguration config)
        {
            services.Configure<TikTokOptions>(config.GetSection(TikTokOptions.SectionName));

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

            // تشفير توكنات تيك توك في قاعدة البيانات
            services.AddDataProtection().SetApplicationName("WasitPlatform");
            services.AddSingleton<ITikTokTokenProtector, TikTokTokenProtector>();

            services.AddScoped<ITikTokApiClient, TikTokApiClient>();
            services.AddScoped<ITikTokRepository, TikTokRepository>();
            services.AddScoped<ITikTokService, TikTokService>();
            services.AddHostedService<TikTokSyncBackgroundService>();

            return services;
        }
    }
}
