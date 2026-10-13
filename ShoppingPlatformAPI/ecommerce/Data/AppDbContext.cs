using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using System.Net;
using static Azure.Core.HttpHeader;

namespace ecommerce.Data
{
    public class AppDbContext: DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // DbSet للـ Users
        public DbSet<User> Users { get; set; }

        // سنضيف باقي الجداول لاحقاً:
        public DbSet<Address> Addresses { get; set; }
        public DbSet<Vendor> Vendors { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<Product> Products { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<SubOrder> SubOrders { get; set; }
        public DbSet<SubOrderItem> SubOrderItems { get; set; }
        public DbSet<Cart> Carts { get; set; }
        public DbSet<CartItem> CartItems { get; set; }
        public DbSet<OrderStatusLog> OrderStatusLogs { get; set; }
        public DbSet<ProductImage> ProductImages { get; set; }
        public DbSet<Wishlist> Wishlists { get; set; }
        public DbSet<Review> Reviews { get; set; }
        public DbSet<ReviewImage> ReviewImages { get; set; }
        public DbSet<ReviewHelpful> ReviewHelpfuls { get; set; }
        public DbSet<ReviewReport> ReviewReports { get; set; }

        public DbSet<Return> Returns { get; set; }
        public DbSet<ReturnItem> ReturnItems { get; set; }
        public DbSet<ReturnImage> ReturnImages { get; set; }

        public DbSet<Driver> Drivers { get; set; }

        public DbSet<Coupon> Coupons { get; set; }
        public DbSet<CouponUsage> CouponUsages { get; set; }

        public DbSet<Promotion> Promotions { get; set; }

        public DbSet<Notification> Notifications { get; set; }
        public DbSet<PushSubscription> PushSubscriptions { get; set; }
        public DbSet<DeliverySettings> DeliverySettings { get; set; }
        public DbSet<DeliveryZone> DeliveryZones { get; set; }
        public DbSet<OrderDriverRating> OrderDriverRatings { get; set; }
        public DbSet<VendorLedgerEntry> VendorLedgerEntries { get; set; }
        public DbSet<DriverCashEntry> DriverCashEntries { get; set; }

        public DbSet<PasswordResetOtp> PasswordResetOtps { get; set; }

        public DbSet<ProductAttribute> ProductAttributes { get; set; }
        public DbSet<ProductAttributeValue> ProductAttributeValues { get; set; }
        public DbSet<ProductVariant> ProductVariants { get; set; }
        public DbSet<ProductVariantAttributeValue> ProductVariantAttributeValues { get; set; }

        public DbSet<Banner> Banners { get; set; }
        public DbSet<HomeSection> HomeSections { get; set; }
        public DbSet<HomeSectionItem> HomeSectionItems { get; set; }

        public DbSet<LoyaltyAccount> LoyaltyAccounts { get; set; }
        public DbSet<LoyaltyTransaction> LoyaltyTransactions { get; set; }
        public DbSet<LoyaltySettings> LoyaltySettings { get; set; }

        public DbSet<OrderRating> OrderRatings { get; set; }
        public DbSet<SubOrderRating> SubOrderRatings { get; set; }

        public DbSet<UserPreferences> UserPreferences { get; set; }

        public DbSet<NumberSequence> NumberSequences { get; set; }

        public DbSet<RefreshToken> RefreshTokens { get; set; }

        public DbSet<StockAlert> StockAlerts { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // إعدادات كل الكيانات في Data/Configurations (IEntityTypeConfiguration) مقسّمة حسب المجال
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        }
        // Override SaveChanges لتحديث UpdatedAt تلقائياً
        public override int SaveChanges()
        {
            UpdateTimestamps();
            return base.SaveChanges();
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            UpdateTimestamps();
            return base.SaveChangesAsync(cancellationToken);
        }

        private void UpdateTimestamps()
        {
            var entries = ChangeTracker.Entries()
         .Where(e => e.State == EntityState.Modified);

            foreach (var entry in entries)
            {
                if (entry.Entity is User user)
                    user.UpdatedAt = DateTime.UtcNow;

                else if (entry.Entity is Address address)
                    address.UpdatedAt = DateTime.UtcNow;

                else if (entry.Entity is Vendor vendor)
                    vendor.UpdatedAt = DateTime.UtcNow;

                else if (entry.Entity is Category category)
                    category.UpdatedAt = DateTime.UtcNow;
                else if (entry.Entity is Product product)
                    product.UpdatedAt = DateTime.UtcNow;
                else if (entry.Entity is Order order)
                    order.UpdatedAt = DateTime.UtcNow;
                else if (entry.Entity is SubOrder subOrder)
                    subOrder.UpdatedAt = DateTime.UtcNow;
                else if (entry.Entity is Review review)
                    review.UpdatedAt = DateTime.UtcNow;
                else if (entry.Entity is Return returnEntity)
                    returnEntity.UpdatedAt = DateTime.UtcNow;
                else if (entry.Entity is Coupon coupon)
                    coupon.UpdatedAt = DateTime.UtcNow;
                else if (entry.Entity is Promotion promotion)
                    promotion.UpdatedAt = DateTime.UtcNow;
                else if (entry.Entity is ProductVariant variant) variant.UpdatedAt = DateTime.UtcNow;
                else if (entry.Entity is Banner banner) banner.UpdatedAt = DateTime.UtcNow;
                else if (entry.Entity is HomeSection section) section.UpdatedAt = DateTime.UtcNow;
                else if (entry.Entity is LoyaltyAccount loyaltyAccount)
                    loyaltyAccount.UpdatedAt = DateTime.UtcNow;



            }
        }


    }
}
