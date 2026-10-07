using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    // ===================================
    // تكوين جدول stock_alerts («أعلمني عند التوفر»)
    // ===================================
    public class StockAlertConfiguration : IEntityTypeConfiguration<StockAlert>
    {
        public void Configure(EntityTypeBuilder<StockAlert> entity)
        {
            entity.ToTable("stock_alerts");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.ProductId).HasColumnName("product_id");
            entity.Property(e => e.VariantId).HasColumnName("variant_id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.NotifiedAt).HasColumnName("notified_at");

            // المعالجة الدورية تبحث عن غير المُرسلة فقط
            entity.HasIndex(e => e.NotifiedAt).HasDatabaseName("idx_stock_alerts_notified_at");
            entity.HasIndex(e => new { e.UserId, e.ProductId }).HasDatabaseName("idx_stock_alerts_user_product");

            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Product).WithMany().HasForeignKey(e => e.ProductId).OnDelete(DeleteBehavior.Cascade);
        }
    }
}
