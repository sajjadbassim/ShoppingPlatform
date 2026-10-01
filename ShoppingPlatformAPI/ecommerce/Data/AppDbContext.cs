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
        public DbSet<OrderDriverRating> OrderDriverRatings { get; set; }
        public DbSet<VendorLedgerEntry> VendorLedgerEntries { get; set; }

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

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // إعدادات الكيانات الجديدة في Data/Configurations (IEntityTypeConfiguration)
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

            // ===================================
            // تكوين جدول Users
            // ===================================
            modelBuilder.Entity<User>(entity =>
            {
                // الجدول والمفتاح الأساسي
                entity.ToTable("users");
                entity.HasKey(e => e.Id);

                // الـ Indexes
                entity.HasIndex(e => e.Phone)
                    .IsUnique()
                    .HasDatabaseName("idx_users_phone");

                entity.HasIndex(e => e.Role)
                    .HasDatabaseName("idx_users_role");

                // حساب Google يُربط بحساب واحد فقط
                entity.HasIndex(e => e.GoogleId)
                    .IsUnique()
                    .HasFilter("[google_id] IS NOT NULL")
                    .HasDatabaseName("idx_users_google_id");
                entity.Property(e => e.GoogleId).HasColumnName("google_id");
                entity.Property(e => e.GoogleEmail).HasColumnName("google_email");
                entity.Property(e => e.HasPassword).HasColumnName("has_password").HasDefaultValue(true);

                entity.HasIndex(e => e.Email)
                    .HasDatabaseName("idx_users_email");

                // القيود
                entity.Property(e => e.Phone)
                    .HasMaxLength(20);

                entity.Property(e => e.Role)
                    .IsRequired()
                    .HasMaxLength(50);

                entity.Property(e => e.FullName)
                    .HasMaxLength(255);

                entity.Property(e => e.Email)
                    .HasMaxLength(255);

                entity.Property(e => e.IsActive)
                    .HasDefaultValue(true);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("CURRENT_TIMESTAMP");

                entity.Property(e => e.UpdatedAt)
                    .HasDefaultValueSql("CURRENT_TIMESTAMP");
            });

            // ===================================
            // تكوين جدول Addresses
            // ===================================
            modelBuilder.Entity<Address>(entity =>
            {
                // اسم الجدول والمفتاح الأساسي
                entity.ToTable("addresses");
                entity.HasKey(e => e.Id);

                // =========================
                // Indexes
                // =========================
                entity.HasIndex(e => e.UserId)
                    .HasDatabaseName("idx_addresses_user_id");

                entity.HasIndex(e => new { e.UserId, e.IsDefault })
                    .HasDatabaseName("idx_addresses_user_default");

                entity.HasIndex(e => e.City)
                    .HasDatabaseName("idx_addresses_city");

                // =========================
                // Properties & Constraints
                // =========================
                entity.Property(e => e.UserId)
                    .IsRequired();

                entity.Property(e => e.Label)
                    .HasMaxLength(100);

                entity.Property(e => e.StreetAddress)
                    .IsRequired();

                entity.Property(e => e.Area)
                    .HasMaxLength(255);

                entity.Property(e => e.City)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.BuildingNumber)
                    .HasMaxLength(50);

                entity.Property(e => e.FloorNumber)
                    .HasMaxLength(50);

                entity.Property(e => e.ApartmentNumber)
                    .HasMaxLength(50);

                entity.Property(e => e.Phone)
                    .HasMaxLength(20);

                entity.Property(e => e.Notes);

                entity.Property(e => e.IsDefault)
                    .HasDefaultValue(false);

                entity.Property(e => e.Latitude)
                    .HasColumnType("decimal(10,8)");

                entity.Property(e => e.Longitude)
                    .HasColumnType("decimal(11,8)");

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("CURRENT_TIMESTAMP");

                entity.Property(e => e.UpdatedAt)
                    .HasDefaultValueSql("CURRENT_TIMESTAMP");

                // =========================
                // Relationships
                // =========================
                entity.HasOne(e => e.User)
                    .WithMany(u => u.Addresses)
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
            // ===================================
            // تكوين جدول Vendors
            // ===================================
            modelBuilder.Entity<Vendor>(entity =>
            {
                // اسم الجدول والمفتاح الأساسي
                entity.ToTable("vendors");
                entity.HasKey(e => e.Id);

                // =========================
                // Indexes
                // =========================
                entity.HasIndex(e => e.Name)
                    .HasDatabaseName("idx_vendors_name");

                entity.HasIndex(e => e.IsActive)
                    .HasDatabaseName("idx_vendors_is_active");

                entity.HasIndex(e => e.Phone)
                    .HasDatabaseName("idx_vendors_phone");

                // =========================
                // Properties & Constraints
                // =========================
                entity.Property(e => e.Name)
                    .IsRequired()
                    .HasMaxLength(255);

                entity.Property(e => e.NameAr)
                    .HasMaxLength(255);

                entity.Property(e => e.Description)
                    .HasMaxLength(1000);

                entity.Property(e => e.LogoUrl)
                    .HasMaxLength(500);

                entity.Property(e => e.Phone)
                    .HasMaxLength(20);

                entity.Property(e => e.Address)
                    .HasMaxLength(500);

                entity.Property(e => e.IsActive)
                    .HasDefaultValue(true);

                entity.Property(e => e.MinOrderAmount)
                    .HasColumnType("decimal(10,2)")
                    .HasDefaultValue(0);

                entity.Property(e => e.DeliveryFee)
                    .HasColumnType("decimal(10,2)")
                    .HasDefaultValue(0);

                entity.Property(e => e.EstimatedPrepTime);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("CURRENT_TIMESTAMP");

                entity.Property(e => e.UpdatedAt)
                    .HasDefaultValueSql("CURRENT_TIMESTAMP");

                // =========================
                // Relationships
                // =========================
                entity.HasOne(e => e.Owner)
                    .WithMany()
                    .HasForeignKey(e => e.OwnerId)
                    .OnDelete(DeleteBehavior.SetNull);
            });

            // ===================================
            // تكوين جدول Categories
            // ===================================
            modelBuilder.Entity<Category>(entity =>
            {
                entity.ToTable("categories");
                entity.HasKey(e => e.Id);

                entity.HasIndex(e => e.Name)
                    .HasDatabaseName("idx_categories_name");

                entity.HasIndex(e => e.ParentId)
                    .HasDatabaseName("idx_categories_parent_id");

                entity.HasIndex(e => e.IsActive)
                    .HasDatabaseName("idx_categories_is_active");

                entity.Property(e => e.Name)
                    .IsRequired()
                    .HasMaxLength(255);

                entity.Property(e => e.NameAr)
                    .HasMaxLength(255);

                entity.Property(e => e.Description)
                    .HasMaxLength(800);

                entity.Property(e => e.IconUrl)
                    .HasMaxLength(500);

                entity.Property(e => e.DisplayOrder)
                    .HasDefaultValue(0);

                entity.Property(e => e.IsActive)
                    .HasDefaultValue(true);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("CURRENT_TIMESTAMP");

                entity.Property(e => e.UpdatedAt)
                    .HasDefaultValueSql("CURRENT_TIMESTAMP");

                // (اختياري) علاقة Self-Reference لاحقاً إذا أضفت Navigation Properties (Parent/Children)
                entity.HasOne(c => c.ParentCategory)
                    .WithMany(c => c.SubCategories)
                    .HasForeignKey(c => c.ParentId)
                    .OnDelete(DeleteBehavior.NoAction);
            });
        
            // تكوين جدول Products
            modelBuilder.Entity<Product>(entity =>
            {
                entity.ToTable("products");
                entity.HasKey(e => e.Id);

                // العلاقات
                entity.HasOne(e => e.Vendor)
                    .WithMany(v => v.Products)
                    .HasForeignKey(e => e.VendorId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Category)
                    .WithMany(c => c.Products)
                    .HasForeignKey(e => e.CategoryId)
                    .OnDelete(DeleteBehavior.SetNull);

                // الـ Indexes
                entity.HasIndex(e => e.VendorId)
                    .HasDatabaseName("idx_products_vendor");

                entity.HasIndex(e => e.CategoryId)
                    .HasDatabaseName("idx_products_category");

                entity.HasIndex(e => new { e.IsActive, e.IsAvailable })
                    .HasDatabaseName("idx_products_active_available");

                entity.HasIndex(e => e.Sku)
                    .HasDatabaseName("idx_products_sku");

                // القيود
                entity.Property(e => e.Name)
                    .IsRequired()
                    .HasMaxLength(255);

                entity.Property(e => e.Price)
                    .IsRequired()
                    .HasColumnType("decimal(10,2)");

                entity.Property(e => e.OriginalPrice)
                    .HasColumnType("decimal(10,2)");

                entity.Property(e => e.IsActive)
                    .HasDefaultValue(true);

                entity.Property(e => e.IsAvailable)
                    .HasDefaultValue(true);

                entity.Property(e => e.StockQuantity)
                    .HasDefaultValue(0);
            });

            // ===================================
            // تكوين جدول Orders
            // ===================================
            modelBuilder.Entity<Order>(entity =>
            {
                entity.ToTable("orders");
                entity.HasKey(e => e.Id);

                // العلاقات
                entity.HasOne(e => e.Customer)
                    .WithMany(u => u.Orders)
                    .HasForeignKey(e => e.CustomerId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Address)
                    .WithMany(a => a.Orders)
                    .HasForeignKey(e => e.AddressId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasMany(e => e.SubOrders)
                    .WithOne(so => so.Order)
                    .HasForeignKey(so => so.OrderId)
                    .OnDelete(DeleteBehavior.Cascade);

                // الـ Indexes
                entity.HasIndex(e => e.OrderNumber)
                    .IsUnique()
                    .HasDatabaseName("idx_orders_number");

                entity.HasIndex(e => e.CustomerId)
                    .HasDatabaseName("idx_orders_customer");

                entity.HasIndex(e => e.Status)
                    .HasDatabaseName("idx_orders_status");

                entity.HasIndex(e => e.CreatedAt)
                    .HasDatabaseName("idx_orders_created");

                // القيود
                entity.Property(e => e.OrderNumber)
                    .IsRequired()
                    .HasMaxLength(50);

                entity.Property(e => e.Status)
                    .IsRequired()
                    .HasMaxLength(50)
                    .HasDefaultValue("PENDING_CONFIRMATION");

                entity.Property(e => e.Subtotal)
                    .IsRequired()
                    .HasColumnType("decimal(10,2)");

                entity.Property(e => e.DeliveryFees)
                    .HasColumnType("decimal(10,2)")
                    .HasDefaultValue(0);

                entity.Property(e => e.TotalAmount)
                    .IsRequired()
                    .HasColumnType("decimal(10,2)");

                entity.Property(e => e.PaymentMethod)
                    .HasMaxLength(50)
                    .HasDefaultValue("COD");

                entity.Property(e => e.PaymentStatus)
                    .HasMaxLength(50)
                    .HasDefaultValue("PENDING");
            });

            // ===================================
            // تكوين جدول SubOrders
            // ===================================
            modelBuilder.Entity<VendorLedgerEntry>(entity =>
            {
                entity.HasIndex(e => new { e.VendorId, e.CreatedAt }).HasDatabaseName("idx_ledger_vendor_date");
                // كل حركة تلقائية مرة واحدة: لكل طلب فرعي، ولكل إرجاع ومتجر
                entity.HasIndex(e => new { e.SubOrderId, e.Type }).IsUnique()
                    .HasFilter("[sub_order_id] IS NOT NULL AND [return_id] IS NULL").HasDatabaseName("idx_ledger_suborder_type");
                entity.HasIndex(e => new { e.ReturnId, e.VendorId, e.Type }).IsUnique()
                    .HasFilter("[return_id] IS NOT NULL").HasDatabaseName("idx_ledger_return_type");
                entity.HasOne(e => e.Vendor).WithMany().HasForeignKey(e => e.VendorId).OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<OrderDriverRating>(entity =>
            {
                entity.HasIndex(r => new { r.OrderRatingId, r.DriverId }).IsUnique().HasDatabaseName("idx_order_driver_ratings_unique");
                entity.HasIndex(r => r.DriverId).HasDatabaseName("idx_order_driver_ratings_driver");
                entity.HasOne(r => r.OrderRating).WithMany(o => o.DriverRatings).HasForeignKey(r => r.OrderRatingId).OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(r => r.Driver).WithMany().HasForeignKey(r => r.DriverId).OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<PushSubscription>(entity =>
            {
                entity.HasIndex(s => s.Endpoint).IsUnique().HasDatabaseName("idx_push_subscriptions_endpoint");
                entity.HasIndex(s => s.UserId).HasDatabaseName("idx_push_subscriptions_user");
                entity.HasOne(s => s.User).WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<Driver>(entity =>
            {
                // حساب واحد لكل سائق
                entity.HasIndex(d => d.UserId)
                    .IsUnique()
                    .HasFilter("[user_id] IS NOT NULL")
                    .HasDatabaseName("idx_drivers_user_id");

                entity.HasOne(d => d.User)
                    .WithMany()
                    .HasForeignKey(d => d.UserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Order>()
                .HasIndex(o => new { o.CashCollectedByDriverId, o.CashSettledAt })
                .HasDatabaseName("idx_orders_driver_cash");

            modelBuilder.Entity<SubOrder>(entity =>
            {
                entity.ToTable("sub_orders");
                entity.HasKey(e => e.Id);

                // العلاقات
                entity.HasOne(e => e.Order)
                    .WithMany(o => o.SubOrders)
                    .HasForeignKey(e => e.OrderId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Vendor)
                    .WithMany(v => v.SubOrders)
                    .HasForeignKey(e => e.VendorId)
                    .OnDelete(DeleteBehavior.Restrict);

                // ✅ الحل: تغيير من SetNull إلى NoAction
                entity.HasOne(e => e.ConfirmedByUser)
                    .WithMany()
                    .HasForeignKey(e => e.ConfirmedBy)
                    .OnDelete(DeleteBehavior.NoAction);  // ⬅️ هنا التغيير

                entity.HasOne(e => e.CancelledByUser)
                    .WithMany()
                    .HasForeignKey(e => e.CancelledBy)
                    .OnDelete(DeleteBehavior.NoAction);  // ⬅️ هنا التغيير

                entity.HasMany(e => e.Items)
                    .WithOne(i => i.SubOrder)
                    .HasForeignKey(i => i.SubOrderId)
                    .OnDelete(DeleteBehavior.Cascade);

                // الـ Indexes
                entity.HasIndex(e => e.OrderId)
                    .HasDatabaseName("idx_sub_orders_order");

                entity.HasIndex(e => e.VendorId)
                    .HasDatabaseName("idx_sub_orders_vendor");

                entity.HasIndex(e => e.Status)
                    .HasDatabaseName("idx_sub_orders_status");

                entity.HasIndex(e => e.ConfirmationDeadline)
                    .HasDatabaseName("idx_sub_orders_deadline");

                entity.HasIndex(e => e.SubOrderNumber)
                    .HasDatabaseName("idx_sub_orders_number");

                // القيود
                entity.Property(e => e.SubOrderNumber)
                    .IsRequired()
                    .HasMaxLength(50);

                entity.Property(e => e.Status)
                    .IsRequired()
                    .HasMaxLength(50)
                    .HasDefaultValue("PENDING_CONFIRMATION");

                entity.Property(e => e.Subtotal)
                    .IsRequired()
                    .HasColumnType("decimal(10,2)");

                entity.Property(e => e.DeliveryFee)
                    .HasColumnType("decimal(10,2)")
                    .HasDefaultValue(0);
            });
            // ===================================
            // تكوين جدول SubOrderItems
            // ===================================
            modelBuilder.Entity<SubOrderItem>(entity =>
            {
                entity.ToTable("sub_order_items");
                entity.HasKey(e => e.Id);

                // العلاقات
                entity.HasOne(e => e.SubOrder)
                    .WithMany(so => so.Items)
                    .HasForeignKey(e => e.SubOrderId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Product)
                    .WithMany(p => p.SubOrderItems)
                    .HasForeignKey(e => e.ProductId)
                    .OnDelete(DeleteBehavior.Restrict);

                // الـ Indexes
                entity.HasIndex(e => e.SubOrderId)
                    .HasDatabaseName("idx_sub_order_items_sub_order");

                entity.HasIndex(e => e.ProductId)
                    .HasDatabaseName("idx_sub_order_items_product");

                // القيود
                entity.Property(e => e.ProductName)
                    .IsRequired()
                    .HasMaxLength(255);

                entity.Property(e => e.UnitPrice)
                    .IsRequired()
                    .HasColumnType("decimal(10,2)");

                entity.Property(e => e.Quantity)
                    .IsRequired();

                entity.Property(e => e.Subtotal)
                    .IsRequired()
                    .HasColumnType("decimal(10,2)");
            });

            // ===================================
            // تكوين جدول Wishlists
            // ===================================
            modelBuilder.Entity<Wishlist>(entity =>
            {
                entity.ToTable("wishlists");
                entity.HasKey(e => e.Id);

                // العلاقات
                entity.HasOne(e => e.User)
                    .WithMany(u => u.Wishlists)
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Product)
                    .WithMany(p => p.Wishlists)
                    .HasForeignKey(e => e.ProductId)
                    .OnDelete(DeleteBehavior.Cascade);

                // الـ Indexes
                entity.HasIndex(e => e.UserId)
                    .HasDatabaseName("idx_wishlists_user_id");

                entity.HasIndex(e => e.ProductId)
                    .HasDatabaseName("idx_wishlists_product_id");

                // Index مركب لمنع التكرار (UserId + ProductId فريد)
                entity.HasIndex(e => new { e.UserId, e.ProductId })
                    .IsUnique()
                    .HasDatabaseName("idx_wishlists_user_product_unique");

                entity.HasIndex(e => e.CreatedAt)
                    .HasDatabaseName("idx_wishlists_created_at");

                // القيود
                entity.Property(e => e.UserId)
                    .IsRequired();

                entity.Property(e => e.ProductId)
                    .IsRequired();

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("CURRENT_TIMESTAMP");
            });

            modelBuilder.Entity<OrderStatusLog>(entity =>
            {
                entity.ToTable("order_status_logs");
                entity.HasKey(e => e.Id);

                // العلاقات
                entity.HasOne(e => e.Order)
                    .WithMany(o => o.StatusLogs)
                    .HasForeignKey(e => e.OrderId)
                    .OnDelete(DeleteBehavior.NoAction);  // ⬅️ غيّر من Cascade إلى NoAction

                entity.HasOne(e => e.SubOrder)
                    .WithMany(so => so.StatusLogs)
                    .HasForeignKey(e => e.SubOrderId)
                    .OnDelete(DeleteBehavior.NoAction);  // ⬅️ غيّر من Cascade إلى NoAction

                entity.HasOne(e => e.ChangedByUser)
                    .WithMany(u => u.StatusChanges)
                    .HasForeignKey(e => e.ChangedBy)
                    .OnDelete(DeleteBehavior.NoAction);  // ⬅️ NoAction

                // الـ Indexes
                entity.HasIndex(e => e.OrderId)
                    .HasDatabaseName("idx_logs_order");

                entity.HasIndex(e => e.SubOrderId)
                    .HasDatabaseName("idx_logs_sub_order");

                entity.HasIndex(e => e.CreatedAt)
                    .HasDatabaseName("idx_logs_created");

                // القيود
                entity.Property(e => e.NewStatus)
                    .IsRequired()
                    .HasMaxLength(50);

                entity.Property(e => e.OldStatus)
                    .IsRequired(false)
                    .HasMaxLength(50);

                entity.Property(e => e.Reason)
                    .IsRequired(false);

                entity.Property(e => e.Notes)
                    .IsRequired(false);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");
            });

            // ===================================
            // تكوين جدول Review
            // ===================================
            modelBuilder.Entity<Review>(entity =>
            {
                entity.ToTable("reviews");
                entity.HasKey(e => e.Id);

                // ─── Indexes ──────────────────────────────────────────
                entity.HasIndex(e => e.ProductId)
                    .HasDatabaseName("idx_reviews_product_id");

                entity.HasIndex(e => e.UserId)
                    .HasDatabaseName("idx_reviews_user_id");

                entity.HasIndex(e => e.Rating)
                    .HasDatabaseName("idx_reviews_rating");

                entity.HasIndex(e => e.IsApproved)
                    .HasDatabaseName("idx_reviews_is_approved");

                entity.HasIndex(e => e.CreatedAt)
                    .HasDatabaseName("idx_reviews_created_at");

                // منع المستخدم من مراجعة نفس المنتج مرتين
                entity.HasIndex(e => new { e.ProductId, e.UserId })
                    .IsUnique()
                    .HasDatabaseName("idx_reviews_product_user_unique");

                // ─── Properties ───────────────────────────────────────
                entity.Property(e => e.Rating)
                    .IsRequired();

                entity.Property(e => e.Title)
                    .HasMaxLength(200);

                entity.Property(e => e.Body)
                    .HasMaxLength(2000);

                entity.Property(e => e.VendorReply)
                    .HasMaxLength(1000);

                entity.Property(e => e.HelpfulCount)
                    .HasDefaultValue(0);

                entity.Property(e => e.IsVerifiedPurchase)
                    .HasDefaultValue(true);

                entity.Property(e => e.IsApproved)
                    .HasDefaultValue(true);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");

                // ─── Relationships ─────────────────────────────────────
                entity.HasOne(e => e.Product)
                    .WithMany(p => p.Reviews)
                    .HasForeignKey(e => e.ProductId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Order)
                    .WithMany()
                    .HasForeignKey(e => e.OrderId)
                    .OnDelete(DeleteBehavior.NoAction);
            });

            modelBuilder.Entity<ReviewImage>(entity =>
            {
                entity.ToTable("review_images");
                entity.HasKey(e => e.Id);

                entity.HasIndex(e => e.ReviewId)
                    .HasDatabaseName("idx_review_images_review_id");

                entity.Property(e => e.ImageUrl)
                    .IsRequired()
                    .HasMaxLength(500);

                entity.Property(e => e.DisplayOrder)
                    .HasDefaultValue(0);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");

                entity.HasOne(e => e.Review)
                    .WithMany(r => r.Images)
                    .HasForeignKey(e => e.ReviewId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ReviewHelpful>(entity =>
            {
                entity.ToTable("review_helpfuls");
                entity.HasKey(e => e.Id);

                // منع المستخدم من التصويت مرتين على نفس المراجعة
                entity.HasIndex(e => new { e.ReviewId, e.UserId })
                    .IsUnique()
                    .HasDatabaseName("idx_review_helpfuls_review_user_unique");

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");

                entity.HasOne(e => e.Review)
                    .WithMany(r => r.HelpfulVotes)
                    .HasForeignKey(e => e.ReviewId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ReviewReport>(entity =>
            {
                entity.ToTable("review_reports");
                entity.HasKey(e => e.Id);

                // منع المستخدم من الإبلاغ عن نفس المراجعة مرتين
                entity.HasIndex(e => new { e.ReviewId, e.UserId })
                    .IsUnique()
                    .HasDatabaseName("idx_review_reports_review_user_unique");

                entity.Property(e => e.Reason)
                    .IsRequired()
                    .HasMaxLength(50);

                entity.Property(e => e.Details)
                    .HasMaxLength(500);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");

                entity.HasOne(e => e.Review)
                    .WithMany(r => r.Reports)
                    .HasForeignKey(e => e.ReviewId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // ===================================
            // تكوين جدول Return
            // ===================================
            modelBuilder.Entity<Return>(entity =>
            {
                entity.ToTable("returns");
                entity.HasKey(e => e.Id);

                // Indexes
                entity.HasIndex(e => e.ReturnNumber)
                    .IsUnique()
                    .HasDatabaseName("idx_returns_number");

                entity.HasIndex(e => e.OrderId)
                    .HasDatabaseName("idx_returns_order_id");

                entity.HasIndex(e => e.CustomerId)
                    .HasDatabaseName("idx_returns_customer_id");

                entity.HasIndex(e => e.Status)
                    .HasDatabaseName("idx_returns_status");

                entity.HasIndex(e => e.CreatedAt)
                    .HasDatabaseName("idx_returns_created_at");

                // Properties
                entity.Property(e => e.ReturnNumber)
                    .IsRequired()
                    .HasMaxLength(50);

                entity.Property(e => e.Status)
                    .IsRequired()
                    .HasMaxLength(50)
                    .HasDefaultValue("PENDING");

                entity.Property(e => e.Reason)
                    .IsRequired()
                    .HasMaxLength(50);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");

                entity.Property(e => e.UpdatedAt)
                    .HasDefaultValueSql("GETDATE()");

                // Relationships
                entity.HasOne(e => e.Order)
                    .WithMany()
                    .HasForeignKey(e => e.OrderId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Customer)
                    .WithMany()
                    .HasForeignKey(e => e.CustomerId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.ReviewedByUser)
                    .WithMany()
                    .HasForeignKey(e => e.ReviewedBy)
                    .OnDelete(DeleteBehavior.NoAction);
            });

            modelBuilder.Entity<ReturnItem>(entity =>
            {
                entity.ToTable("return_items");
                entity.HasKey(e => e.Id);

                entity.HasIndex(e => e.ReturnId)
                    .HasDatabaseName("idx_return_items_return_id");

                entity.Property(e => e.ProductName)
                    .IsRequired()
                    .HasMaxLength(255);

                entity.Property(e => e.UnitPrice)
                    .IsRequired()
                    .HasColumnType("decimal(10,2)");

                entity.HasOne(e => e.Return)
                    .WithMany(r => r.Items)
                    .HasForeignKey(e => e.ReturnId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Product)
                    .WithMany()
                    .HasForeignKey(e => e.ProductId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ReturnImage>(entity =>
            {
                entity.ToTable("return_images");
                entity.HasKey(e => e.Id);

                entity.Property(e => e.ImageUrl)
                    .IsRequired()
                    .HasMaxLength(500);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");

                entity.HasOne(e => e.Return)
                    .WithMany(r => r.Images)
                    .HasForeignKey(e => e.ReturnId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
            // ===================================
            // تكوين جدول coupons
            // ===================================
            modelBuilder.Entity<Coupon>(entity =>
            {
                entity.ToTable("coupons");
                entity.HasKey(e => e.Id);

                entity.HasIndex(e => e.Code)
                    .IsUnique()
                    .HasDatabaseName("idx_coupons_code");

                entity.HasIndex(e => e.IsActive)
                    .HasDatabaseName("idx_coupons_is_active");

                entity.HasIndex(e => e.ExpiresAt)
                    .HasDatabaseName("idx_coupons_expires_at");

                entity.Property(e => e.Code)
                    .IsRequired()
                    .HasMaxLength(50);

                entity.Property(e => e.DiscountType)
                    .IsRequired()
                    .HasMaxLength(20);

                entity.Property(e => e.DiscountValue)
                    .IsRequired()
                    .HasColumnType("decimal(10,2)");

                entity.Property(e => e.MinOrderAmount)
                    .HasColumnType("decimal(10,2)")
                    .HasDefaultValue(0);

                entity.Property(e => e.MaxDiscountAmount)
                    .HasColumnType("decimal(10,2)");

                entity.Property(e => e.UsageCount)
                    .HasDefaultValue(0);

                entity.Property(e => e.UserUsageLimit)
                    .HasDefaultValue(1);

                entity.Property(e => e.IsActive)
                    .HasDefaultValue(true);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");

                entity.Property(e => e.UpdatedAt)
                    .HasDefaultValueSql("GETDATE()");

                entity.HasOne(e => e.Vendor)
                    .WithMany()
                    .HasForeignKey(e => e.VendorId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasOne(e => e.Category)
                    .WithMany()
                    .HasForeignKey(e => e.CategoryId)
                    .OnDelete(DeleteBehavior.SetNull);
            });

            modelBuilder.Entity<CouponUsage>(entity =>
            {
                entity.ToTable("coupon_usages");
                entity.HasKey(e => e.Id);

                // منع استخدام نفس الكوبون مرتين في نفس الطلب
                entity.HasIndex(e => new { e.CouponId, e.OrderId })
                    .IsUnique()
                    .HasDatabaseName("idx_coupon_usages_coupon_order_unique");

                entity.HasIndex(e => new { e.CouponId, e.UserId })
                    .HasDatabaseName("idx_coupon_usages_coupon_user");

                entity.Property(e => e.DiscountAmount)
                    .IsRequired()
                    .HasColumnType("decimal(10,2)");

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");

                entity.HasOne(e => e.Coupon)
                    .WithMany(c => c.Usages)
                    .HasForeignKey(e => e.CouponId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Order)
                    .WithMany()
                    .HasForeignKey(e => e.OrderId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // ===================================
            // تكوين جدول Promotions 
            // ===================================
            modelBuilder.Entity<Promotion>(entity =>
            {
                entity.ToTable("promotions");
                entity.HasKey(e => e.Id);

                entity.HasIndex(e => e.IsActive)
                    .HasDatabaseName("idx_promotions_is_active");

                entity.HasIndex(e => e.TargetType)
                    .HasDatabaseName("idx_promotions_target_type");

                entity.HasIndex(e => new { e.TargetType, e.TargetId })
                    .HasDatabaseName("idx_promotions_target");

                entity.HasIndex(e => e.ExpiresAt)
                    .HasDatabaseName("idx_promotions_expires_at");

                entity.Property(e => e.Name)
                    .IsRequired()
                    .HasMaxLength(255);

                entity.Property(e => e.TargetType)
                    .IsRequired()
                    .HasMaxLength(20);

                entity.Property(e => e.DiscountType)
                    .IsRequired()
                    .HasMaxLength(20);

                entity.Property(e => e.DiscountValue)
                    .IsRequired()
                    .HasColumnType("decimal(10,2)");

                entity.Property(e => e.MaxDiscountAmount)
                    .HasColumnType("decimal(10,2)");

                entity.Property(e => e.IsActive)
                    .HasDefaultValue(true);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");

                entity.Property(e => e.UpdatedAt)
                    .HasDefaultValueSql("GETDATE()");
            });

            // ===================================
            // تكوين جدول Notification 
            // ===================================
            modelBuilder.Entity<Notification>(entity =>
            {
                entity.ToTable("notifications");
                entity.HasKey(e => e.Id);

                entity.HasIndex(e => e.UserId)
                    .HasDatabaseName("idx_notifications_user_id");

                entity.HasIndex(e => new { e.UserId, e.IsRead })
                    .HasDatabaseName("idx_notifications_user_unread");

                entity.HasIndex(e => e.CreatedAt)
                    .HasDatabaseName("idx_notifications_created_at");

                entity.Property(e => e.Type).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Message).IsRequired().HasMaxLength(500);
                entity.Property(e => e.IsRead).HasDefaultValue(false);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETDATE()");

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
            // ===================================
            // تكوين جدول PasswordResetOtp
            // ===================================
            modelBuilder.Entity<PasswordResetOtp>(entity =>
            {
                entity.ToTable("password_reset_otps");
                entity.HasKey(e => e.Id);

                entity.HasIndex(e => e.UserId)
                    .HasDatabaseName("idx_password_reset_otps_user_id");

                entity.HasIndex(e => e.ResetToken)
                    .HasDatabaseName("idx_password_reset_otps_reset_token");

                entity.Property(e => e.CodeHash).IsRequired().HasMaxLength(255);
                entity.Property(e => e.Attempts).HasDefaultValue(0);
                entity.Property(e => e.IsVerified).HasDefaultValue(false);
                entity.Property(e => e.IsUsed).HasDefaultValue(false);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETDATE()");

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // ===================================
            // تكوين جدول ProductAttribute
            // ===================================
            modelBuilder.Entity<ProductAttribute>(entity =>
            {
                entity.ToTable("product_attributes");
                entity.HasKey(e => e.Id);
                entity.HasOne(e => e.Product)
                    .WithMany()
                    .HasForeignKey(e => e.ProductId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ProductAttributeValue>(entity =>
            {
                entity.ToTable("product_attribute_values");
                entity.HasKey(e => e.Id);
                entity.HasOne(e => e.Attribute)
                    .WithMany(a => a.Values)
                    .HasForeignKey(e => e.AttributeId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ProductVariant>(entity =>
            {
                entity.ToTable("product_variants");
                entity.HasKey(e => e.Id);
                entity.HasOne(e => e.Product)
                    .WithMany()
                    .HasForeignKey(e => e.ProductId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ProductVariantAttributeValue>(entity =>
            {
                entity.ToTable("product_variant_attribute_values");
                entity.HasKey(e => e.Id);
                entity.HasOne(e => e.Variant)
                    .WithMany(v => v.AttributeValues)
                    .HasForeignKey(e => e.VariantId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(e => e.AttributeValue)
                    .WithMany(av => av.VariantValues)
                    .HasForeignKey(e => e.AttributeValueId)
                    .OnDelete(DeleteBehavior.NoAction);
            });
            // ===================================
            // تكوين جدول Banner 
            // ===================================
            modelBuilder.Entity<Banner>(entity =>
            {
                entity.ToTable("banners");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.IsActive).HasDefaultValue(true);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETDATE()");
                entity.Property(e => e.UpdatedAt).HasDefaultValueSql("GETDATE()");
            });

            modelBuilder.Entity<HomeSection>(entity =>
            {
                entity.ToTable("home_sections");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.IsActive).HasDefaultValue(true);
                entity.Property(e => e.MaxItems).HasDefaultValue(10);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETDATE()");
                entity.Property(e => e.UpdatedAt).HasDefaultValueSql("GETDATE()");
            });

            modelBuilder.Entity<HomeSectionItem>(entity =>
            {
                entity.ToTable("home_section_items");
                entity.HasKey(e => e.Id);
                entity.HasOne(e => e.Section)
                    .WithMany(s => s.Items)
                    .HasForeignKey(e => e.SectionId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // ===================================
            // تكوين جدول SubOrderRating 
            // ===================================
            modelBuilder.Entity<SubOrderRating>(entity =>
            {
                entity.HasOne(sr => sr.SubOrder)
                      .WithMany()
                      .HasForeignKey(sr => sr.SubOrderId)
                      .OnDelete(DeleteBehavior.NoAction);

                entity.HasOne(sr => sr.Vendor)
                      .WithMany()
                      .HasForeignKey(sr => sr.VendorId)
                      .OnDelete(DeleteBehavior.NoAction);

                entity.HasOne(sr => sr.Driver)
                      .WithMany()
                      .HasForeignKey(sr => sr.DriverId)
                      .OnDelete(DeleteBehavior.NoAction);
            });

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
