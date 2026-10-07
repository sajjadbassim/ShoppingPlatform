using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    // ===================================
    // تكوين جدول Review
    // ===================================
    public class ReviewConfiguration : IEntityTypeConfiguration<Review>
    {
        public void Configure(EntityTypeBuilder<Review> entity)
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
        }
    }

    public class ReviewImageConfiguration : IEntityTypeConfiguration<ReviewImage>
    {
        public void Configure(EntityTypeBuilder<ReviewImage> entity)
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
        }
    }

    public class ReviewHelpfulConfiguration : IEntityTypeConfiguration<ReviewHelpful>
    {
        public void Configure(EntityTypeBuilder<ReviewHelpful> entity)
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
        }
    }

    public class ReviewReportConfiguration : IEntityTypeConfiguration<ReviewReport>
    {
        public void Configure(EntityTypeBuilder<ReviewReport> entity)
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
        }
    }
}
