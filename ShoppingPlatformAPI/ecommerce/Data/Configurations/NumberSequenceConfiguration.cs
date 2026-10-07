using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    public class NumberSequenceConfiguration : IEntityTypeConfiguration<NumberSequence>
    {
        public void Configure(EntityTypeBuilder<NumberSequence> builder)
        {
            // اسم الجدول والأعمدة مستخدمة حرفياً في DailyNumberGenerator
            builder.ToTable("number_sequences");
            builder.HasKey(s => s.Key);
            builder.Property(s => s.Key).HasColumnName("key").HasMaxLength(40);
            builder.Property(s => s.LastValue).HasColumnName("last_value");
        }
    }
}
