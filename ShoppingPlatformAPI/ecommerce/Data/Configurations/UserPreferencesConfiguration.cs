using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    public class UserPreferencesConfiguration : IEntityTypeConfiguration<UserPreferences>
    {
        public void Configure(EntityTypeBuilder<UserPreferences> builder)
        {
            builder.ToTable("user_preferences");

            // علاقة 1:1 — المفتاح الأساسي هو نفسه معرّف المستخدم
            builder.HasKey(p => p.UserId);
            builder.Property(p => p.UserId).HasColumnName("user_id");

            builder.HasOne(p => p.User)
                .WithOne()
                .HasForeignKey<UserPreferences>(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(p => p.Language).HasColumnName("language").HasMaxLength(5).IsRequired();
            builder.Property(p => p.Theme).HasColumnName("theme").HasMaxLength(10).IsRequired();
            builder.Property(p => p.Currency).HasColumnName("currency").HasMaxLength(3).IsRequired();

            builder.Property(p => p.NotifyOrderUpdates).HasColumnName("notify_order_updates");
            builder.Property(p => p.NotifyNewOrders).HasColumnName("notify_new_orders");
            builder.Property(p => p.NotifyOrderConfirmations).HasColumnName("notify_order_confirmations");
            builder.Property(p => p.NotifyLowStock).HasColumnName("notify_low_stock");
            builder.Property(p => p.NotifyReviews).HasColumnName("notify_reviews");
            builder.Property(p => p.NotifyReturns).HasColumnName("notify_returns");
            builder.Property(p => p.NotifyNewUsers).HasColumnName("notify_new_users");
            builder.Property(p => p.NotifyNewVendors).HasColumnName("notify_new_vendors");

            builder.Property(p => p.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2");
            builder.Property(p => p.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2");
        }
    }
}
