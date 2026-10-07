using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
    {
        public void Configure(EntityTypeBuilder<RefreshToken> builder)
        {
            builder.ToTable("refresh_tokens");
            builder.HasKey(t => t.Id);
            builder.Property(t => t.Id).HasColumnName("id");

            builder.Property(t => t.UserId).HasColumnName("user_id");
            builder.HasOne(t => t.User)
                .WithMany()
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            builder.HasIndex(t => t.UserId);

            builder.Property(t => t.TokenHash).HasColumnName("token_hash").HasMaxLength(64).IsRequired();
            builder.HasIndex(t => t.TokenHash).IsUnique();

            builder.Property(t => t.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2");
            builder.Property(t => t.ExpiresAt).HasColumnName("expires_at").HasColumnType("datetime2");
            builder.Property(t => t.RevokedAt).HasColumnName("revoked_at").HasColumnType("datetime2");
            builder.Property(t => t.ReplacedAt).HasColumnName("replaced_at").HasColumnType("datetime2");
        }
    }
}
