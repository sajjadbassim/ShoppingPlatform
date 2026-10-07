using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    // ===================================
    // تكوين جدول Users
    // ===================================
    public class UserConfiguration : IEntityTypeConfiguration<User>
    {
        public void Configure(EntityTypeBuilder<User> entity)
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
            entity.Property(e => e.AvatarUrl).HasColumnName("avatar_url");
            entity.Property(e => e.AvatarSource).HasColumnName("avatar_source");
            entity.Property(e => e.GooglePictureUrl).HasColumnName("google_picture_url");
            entity.Property(e => e.HasPassword).HasColumnName("has_password").HasDefaultValue(true);

            entity.HasIndex(e => e.Email)
                .HasDatabaseName("idx_users_email");

            // رمز الدعوة فريد (للحسابات التي أُنشئ لها رمز فقط)
            entity.HasIndex(e => e.ReferralCode)
                .IsUnique()
                .HasFilter("[referral_code] IS NOT NULL")
                .HasDatabaseName("idx_users_referral_code");
            entity.HasIndex(e => e.ReferredByUserId)
                .HasDatabaseName("idx_users_referred_by");

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
        }
    }

    // ===================================
    // تكوين جدول Addresses
    // ===================================
    public class AddressConfiguration : IEntityTypeConfiguration<Address>
    {
        public void Configure(EntityTypeBuilder<Address> entity)
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

            // حذف المنطقة لا يحذف العناوين — تبقى بلا منطقة
            entity.HasOne(e => e.Zone).WithMany()
                .HasForeignKey(e => e.ZoneId)
                .OnDelete(DeleteBehavior.SetNull);

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
        }
    }

    public class PushSubscriptionConfiguration : IEntityTypeConfiguration<PushSubscription>
    {
        public void Configure(EntityTypeBuilder<PushSubscription> entity)
        {
            entity.HasIndex(s => s.Endpoint).IsUnique().HasDatabaseName("idx_push_subscriptions_endpoint");
            entity.HasIndex(s => s.UserId).HasDatabaseName("idx_push_subscriptions_user");
            entity.HasOne(s => s.User).WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
        }
    }

    // ===================================
    // تكوين جدول Notification 
    // ===================================
    public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
    {
        public void Configure(EntityTypeBuilder<Notification> entity)
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
        }
    }

    // ===================================
    // تكوين جدول PasswordResetOtp
    // ===================================
    public class PasswordResetOtpConfiguration : IEntityTypeConfiguration<PasswordResetOtp>
    {
        public void Configure(EntityTypeBuilder<PasswordResetOtp> entity)
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
        }
    }
}
