using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    public class FacebookConnectionConfiguration : IEntityTypeConfiguration<FacebookConnection>
    {
        public void Configure(EntityTypeBuilder<FacebookConnection> builder)
        {
            builder.ToTable("facebook_connections");
            builder.HasKey(c => c.Id);
            builder.Property(c => c.Id).HasColumnName("id");

            builder.Property(c => c.VendorId).HasColumnName("vendor_id");
            builder.HasIndex(c => c.VendorId).IsUnique();
            builder.HasOne(c => c.Vendor)
                .WithMany()
                .HasForeignKey(c => c.VendorId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(c => c.FacebookUserId).HasColumnName("facebook_user_id").HasMaxLength(64).IsRequired();
            builder.HasIndex(c => c.FacebookUserId);

            builder.Property(c => c.PageId).HasColumnName("page_id").HasMaxLength(64).IsRequired();
            builder.Property(c => c.PageName).HasColumnName("page_name").HasMaxLength(200);
            builder.Property(c => c.PageUsername).HasColumnName("page_username").HasMaxLength(100);
            builder.Property(c => c.PagePictureUrl).HasColumnName("page_picture_url");
            builder.Property(c => c.PageLink).HasColumnName("page_link").HasMaxLength(500);
            builder.Property(c => c.FollowersCount).HasColumnName("followers_count");

            builder.Property(c => c.PageAccessTokenProtected).HasColumnName("page_access_token_protected").IsRequired();
            builder.Property(c => c.Scopes).HasColumnName("scopes").HasMaxLength(500).IsRequired();

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

    public class FacebookMediaConfiguration : IEntityTypeConfiguration<FacebookMedia>
    {
        public void Configure(EntityTypeBuilder<FacebookMedia> builder)
        {
            builder.ToTable("facebook_media");
            builder.HasKey(m => m.Id);
            builder.Property(m => m.Id).HasColumnName("id");

            builder.Property(m => m.ConnectionId).HasColumnName("connection_id");
            builder.HasOne(m => m.Connection)
                .WithMany(c => c.Media)
                .HasForeignKey(m => m.ConnectionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(m => m.ExternalId).HasColumnName("external_id").HasMaxLength(100).IsRequired();
            builder.HasIndex(m => new { m.ConnectionId, m.ExternalId }).IsUnique();

            builder.Property(m => m.MediaType).HasColumnName("media_type").HasMaxLength(20).IsRequired();
            builder.Property(m => m.IsReel).HasColumnName("is_reel");
            builder.Property(m => m.Caption).HasColumnName("caption").HasMaxLength(2200);

            // روابط CDN فيسبوك طويلة وموقّعة — لا تُقص
            builder.Property(m => m.MediaUrl).HasColumnName("media_url");
            builder.Property(m => m.ThumbnailUrl).HasColumnName("thumbnail_url");
            builder.Property(m => m.Permalink).HasColumnName("permalink").HasMaxLength(500);
            builder.Property(m => m.DurationSeconds).HasColumnName("duration_seconds");
            builder.Property(m => m.ChildrenJson).HasColumnName("children_json");
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

    public class FacebookOAuthStateConfiguration : IEntityTypeConfiguration<FacebookOAuthState>
    {
        public void Configure(EntityTypeBuilder<FacebookOAuthState> builder)
        {
            builder.ToTable("facebook_oauth_states");
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
