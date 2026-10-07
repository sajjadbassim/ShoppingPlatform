using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    public class LoyaltyTransactionConfiguration : IEntityTypeConfiguration<LoyaltyTransaction>
    {
        public void Configure(EntityTypeBuilder<LoyaltyTransaction> builder)
        {
            // نفس الحدث لا يمنح نقاطاً مرتين حتى لو وصل طلبان متزامنان (التسليم من السائق والعمليات معاً)
            builder.HasIndex(t => new { t.AccountId, t.ReferenceKey })
                .IsUnique()
                .HasFilter("[reference_key] IS NOT NULL")
                .HasDatabaseName("idx_loyalty_transactions_reference");

            // الفهرس أعلاه مُرشَّح فلا يغطي كل الصفوف — يبقى فهرس الحساب لسجل النقاط
            builder.HasIndex(t => t.AccountId);
        }
    }
}
