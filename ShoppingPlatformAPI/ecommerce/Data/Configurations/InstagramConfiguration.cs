using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    public class InstagramConnectionConfiguration : IEntityTypeConfiguration<InstagramConnection>
    {
        public void Configure(EntityTypeBuilder<InstagramConnection> builder)
        {
            builder.ToTable("instagram_connections");
            builder.HasKey(c => c.Id);
            builder.Property(c => c.Id).HasColumnName("id");

            builder.Property(c => c.VendorId).HasColumnName("vendor_id");
            builder.HasIndex(c => c.VendorId).IsUnique();
            builder.HasOne(c => c.Vendor)
                .WithMany()
                .HasForeignKey(c => c.VendorId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(c => c.InstagramUserId).HasColumnName("instagram_user_id").HasMaxLength(64).IsRequired();
            builder.HasIndex(c => c.InstagramUserId);
            builder.Property(c => c.AccountId).HasColumnName("account_id").HasMaxLength(64);

            builder.Property(c => c.AccessTokenProtected).HasColumnName("access_token_protected").IsRequired();
            builder.Property(c => c.AccessTokenIssuedAt).HasColumnName("access_token_issued_at").HasColumnType("datetime2");
            builder.Property(c => c.AccessTokenExpiresAt).HasColumnName("access_token_expires_at").HasColumnType("datetime2");
            builder.Property(c => c.Scopes).HasColumnName("scopes").HasMaxLength(500).IsRequired();

            builder.Property(c => c.Username).HasColumnName("username").HasMaxLength(100);
            builder.Property(c => c.Name).HasColumnName("name").HasMaxLength(200);
            builder.Property(c => c.AccountType).HasColumnName("account_type").HasMaxLength(30);
            builder.Property(c => c.ProfilePictureUrl).HasColumnName("profile_picture_url");
            builder.Property(c => c.FollowersCount).HasColumnName("followers_count");
            builder.Property(c => c.MediaCount).HasColumnName("media_count");

            builder.Property(c => c.ShowOnStore).HasColumnName("show_on_store");
            builder.Property(c => c.AutoShowNewMedia).HasColumnName("auto_show_new_media");

            builder.Property(c => c.ConnectedAt).HasColumnName("connected_at").HasColumnType("datetime2");
            builder.Property(c => c.LastSyncedAt).HasColumnName("last_synced_at").HasColumnType("datetime2");
            builder.Property(c => c.LastFullSyncedAt).HasColumnName("last_full_synced_at").HasColumnType("datetime2");
            builder.Property(c => c.LastSyncError).HasColumnName("last_sync_error").HasMaxLength(500);
            builder.Property(c => c.NeedsReconnect).HasColumnName("needs_reconnect");

            builder.Property(c => c.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2");
            builder.Property(c => c.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2");
        }
    }

    public class InstagramMediaConfiguration : IEntityTypeConfiguration<InstagramMedia>
    {
        public void Configure(EntityTypeBuilder<InstagramMedia> builder)
        {
            builder.ToTable("instagram_media");
            builder.HasKey(m => m.Id);
            builder.Property(m => m.Id).HasColumnName("id");

            builder.Property(m => m.ConnectionId).HasColumnName("connection_id");
            builder.HasOne(m => m.Connection)
                .WithMany(c => c.Media)
                .HasForeignKey(m => m.ConnectionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(m => m.ExternalId).HasColumnName("external_id").HasMaxLength(64).IsRequired();
            builder.HasIndex(m => new { m.ConnectionId, m.ExternalId }).IsUnique();

            builder.Property(m => m.MediaType).HasColumnName("media_type").HasMaxLength(20).IsRequired();
            builder.Property(m => m.MediaProductType).HasColumnName("media_product_type").HasMaxLength(20);
            builder.Property(m => m.Caption).HasColumnName("caption").HasMaxLength(2200);

            // روابط CDN إنستغرام طويلة وموقّعة — لا تُقص
            builder.Property(m => m.MediaUrl).HasColumnName("media_url");
            builder.Property(m => m.ThumbnailUrl).HasColumnName("thumbnail_url");
            builder.Property(m => m.Permalink).HasColumnName("permalink").HasMaxLength(500);
            builder.Property(m => m.ChildrenJson).HasColumnName("children_json");

            builder.Property(m => m.LikeCount).HasColumnName("like_count");
            builder.Property(m => m.CommentsCount).HasColumnName("comments_count");
            builder.Property(m => m.PublishedAt).HasColumnName("published_at").HasColumnType("datetime2");

            builder.Property(m => m.IsHidden).HasColumnName("is_hidden");
            builder.Property(m => m.IsRemoved).HasColumnName("is_removed");

            // المنتجات تُحذف حذفاً ناعماً؛ المنتج غير النشط لا يُعرض
            builder.Property(m => m.ProductId).HasColumnName("product_id");
            builder.HasOne(m => m.Product)
                .WithMany()
                .HasForeignKey(m => m.ProductId)
                .OnDelete(DeleteBehavior.NoAction);

            builder.Property(m => m.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2");
            builder.Property(m => m.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2");
        }
    }

    public class InstagramOAuthStateConfiguration : IEntityTypeConfiguration<InstagramOAuthState>
    {
        public void Configure(EntityTypeBuilder<InstagramOAuthState> builder)
        {
            builder.ToTable("instagram_oauth_states");
            builder.HasKey(s => s.State);
            builder.Property(s => s.State).HasColumnName("state").HasMaxLength(100);
            builder.Property(s => s.VendorId).HasColumnName("vendor_id");
            builder.Property(s => s.NonceHash).HasColumnName("nonce_hash").HasMaxLength(100).IsRequired();
            builder.Property(s => s.ExpiresAt).HasColumnName("expires_at").HasColumnType("datetime2");
            builder.Property(s => s.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2");
            builder.HasIndex(s => s.ExpiresAt);
        }
    }
}
