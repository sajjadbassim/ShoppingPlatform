using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    // ===================================
    // تكوين جدول coupons
    // ===================================
    public class CouponConfiguration : IEntityTypeConfiguration<Coupon>
    {
        public void Configure(EntityTypeBuilder<Coupon> entity)
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
        }
    }

    public class CouponUsageConfiguration : IEntityTypeConfiguration<CouponUsage>
    {
        public void Configure(EntityTypeBuilder<CouponUsage> entity)
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
        }
    }

    // ===================================
    // تكوين جدول Promotions 
    // ===================================
    public class PromotionConfiguration : IEntityTypeConfiguration<Promotion>
    {
        public void Configure(EntityTypeBuilder<Promotion> entity)
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
        }
    }

    // ===================================
    // تكوين جدول Banner 
    // ===================================
    public class BannerConfiguration : IEntityTypeConfiguration<Banner>
    {
        public void Configure(EntityTypeBuilder<Banner> entity)
        {
            entity.ToTable("banners");
            entity.HasKey(e => e.Id);
            // بانرات "بلوك البانرات" تُحذف مع قسمها
            entity.HasOne<HomeSection>().WithMany().HasForeignKey(e => e.SectionId).OnDelete(DeleteBehavior.Cascade);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETDATE()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("GETDATE()");
        }
    }

    public class HomeSectionConfiguration : IEntityTypeConfiguration<HomeSection>
    {
        public void Configure(EntityTypeBuilder<HomeSection> entity)
        {
            entity.ToTable("home_sections");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.MaxItems).HasDefaultValue(10);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETDATE()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("GETDATE()");
        }
    }

    public class HomeSectionItemConfiguration : IEntityTypeConfiguration<HomeSectionItem>
    {
        public void Configure(EntityTypeBuilder<HomeSectionItem> entity)
        {
            entity.ToTable("home_section_items");
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Section)
                .WithMany(s => s.Items)
                .HasForeignKey(e => e.SectionId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
