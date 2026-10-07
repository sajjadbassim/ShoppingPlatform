using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    // ===================================
    // تكوين جدول Return
    // ===================================
    public class ReturnConfiguration : IEntityTypeConfiguration<Return>
    {
        public void Configure(EntityTypeBuilder<Return> entity)
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
        }
    }

    public class ReturnItemConfiguration : IEntityTypeConfiguration<ReturnItem>
    {
        public void Configure(EntityTypeBuilder<ReturnItem> entity)
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
        }
    }

    public class ReturnImageConfiguration : IEntityTypeConfiguration<ReturnImage>
    {
        public void Configure(EntityTypeBuilder<ReturnImage> entity)
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
        }
    }
}
