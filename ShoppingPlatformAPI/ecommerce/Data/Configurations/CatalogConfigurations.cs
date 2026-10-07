using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    // ===================================
    // تكوين جدول Vendors
    // ===================================
    public class VendorConfiguration : IEntityTypeConfiguration<Vendor>
    {
        public void Configure(EntityTypeBuilder<Vendor> entity)
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
        }
    }

    // ===================================
    // تكوين جدول Categories
    // ===================================
    public class CategoryConfiguration : IEntityTypeConfiguration<Category>
    {
        public void Configure(EntityTypeBuilder<Category> entity)
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
        }
    }

    // تكوين جدول Products
    public class ProductConfiguration : IEntityTypeConfiguration<Product>
    {
        public void Configure(EntityTypeBuilder<Product> entity)
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
        }
    }

    // ===================================
    // تكوين جدول Wishlists
    // ===================================
    public class WishlistConfiguration : IEntityTypeConfiguration<Wishlist>
    {
        public void Configure(EntityTypeBuilder<Wishlist> entity)
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
        }
    }

    // ===================================
    // تكوين جدول ProductAttribute
    // ===================================
    public class ProductAttributeConfiguration : IEntityTypeConfiguration<ProductAttribute>
    {
        public void Configure(EntityTypeBuilder<ProductAttribute> entity)
        {
            entity.ToTable("product_attributes");
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Product)
                .WithMany()
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class ProductAttributeValueConfiguration : IEntityTypeConfiguration<ProductAttributeValue>
    {
        public void Configure(EntityTypeBuilder<ProductAttributeValue> entity)
        {
            entity.ToTable("product_attribute_values");
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Attribute)
                .WithMany(a => a.Values)
                .HasForeignKey(e => e.AttributeId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
    {
        public void Configure(EntityTypeBuilder<ProductVariant> entity)
        {
            entity.ToTable("product_variants");
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Product)
                .WithMany()
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class ProductVariantAttributeValueConfiguration : IEntityTypeConfiguration<ProductVariantAttributeValue>
    {
        public void Configure(EntityTypeBuilder<ProductVariantAttributeValue> entity)
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
        }
    }
}
