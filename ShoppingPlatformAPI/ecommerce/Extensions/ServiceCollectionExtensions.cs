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
using ecommerce.Services.UserPreferencesService;
using ecommerce.Services.VendorService.VendorService;
using Microsoft.EntityFrameworkCore;

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
    }
}
