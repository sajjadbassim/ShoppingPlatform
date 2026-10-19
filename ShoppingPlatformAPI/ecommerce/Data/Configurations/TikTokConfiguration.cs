using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    public class TikTokConnectionConfiguration : IEntityTypeConfiguration<TikTokConnection>
    {
        public void Configure(EntityTypeBuilder<TikTokConnection> builder)
        {
            builder.ToTable("tiktok_connections");
            builder.HasKey(c => c.Id);
            builder.Property(c => c.Id).HasColumnName("id");

            builder.Property(c => c.VendorId).HasColumnName("vendor_id");
            builder.HasIndex(c => c.VendorId).IsUnique();
            builder.HasOne(c => c.Vendor)
                .WithMany()
                .HasForeignKey(c => c.VendorId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(c => c.OpenId).HasColumnName("open_id").HasMaxLength(128).IsRequired();
            builder.Property(c => c.AccessTokenProtected).HasColumnName("access_token_protected").IsRequired();
            builder.Property(c => c.RefreshTokenProtected).HasColumnName("refresh_token_protected").IsRequired();
            builder.Property(c => c.AccessTokenExpiresAt).HasColumnName("access_token_expires_at").HasColumnType("datetime2");
            builder.Property(c => c.RefreshTokenExpiresAt).HasColumnName("refresh_token_expires_at").HasColumnType("datetime2");
            builder.Property(c => c.Scopes).HasColumnName("scopes").HasMaxLength(500).IsRequired();

            builder.Property(c => c.DisplayName).HasColumnName("display_name").HasMaxLength(200);
            builder.Property(c => c.Username).HasColumnName("username").HasMaxLength(100);
            builder.Property(c => c.AvatarUrl).HasColumnName("avatar_url").HasMaxLength(2000);
            builder.Property(c => c.ProfileUrl).HasColumnName("profile_url").HasMaxLength(2000);
            builder.Property(c => c.FollowerCount).HasColumnName("follower_count");
            builder.Property(c => c.LikesCount).HasColumnName("likes_count");
            builder.Property(c => c.VideoCount).HasColumnName("video_count");

            builder.Property(c => c.ShowOnStore).HasColumnName("show_on_store");
            builder.Property(c => c.AutoShowNewVideos).HasColumnName("auto_show_new_videos");

            builder.Property(c => c.ConnectedAt).HasColumnName("connected_at").HasColumnType("datetime2");
            builder.Property(c => c.LastSyncedAt).HasColumnName("last_synced_at").HasColumnType("datetime2");
            builder.Property(c => c.LastSyncError).HasColumnName("last_sync_error").HasMaxLength(500);
            builder.Property(c => c.NeedsReconnect).HasColumnName("needs_reconnect");

            builder.Property(c => c.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2");
            builder.Property(c => c.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2");
        }
    }

    public class TikTokVideoConfiguration : IEntityTypeConfiguration<TikTokVideo>
    {
        public void Configure(EntityTypeBuilder<TikTokVideo> builder)
        {
            builder.ToTable("tiktok_videos");
            builder.HasKey(v => v.Id);
            builder.Property(v => v.Id).HasColumnName("id");

            builder.Property(v => v.ConnectionId).HasColumnName("connection_id");
            builder.HasOne(v => v.Connection)
                .WithMany(c => c.Videos)
                .HasForeignKey(v => v.ConnectionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(v => v.ExternalId).HasColumnName("external_id").HasMaxLength(64).IsRequired();
            builder.HasIndex(v => new { v.ConnectionId, v.ExternalId }).IsUnique();

            builder.Property(v => v.Title).HasColumnName("title").HasMaxLength(500);
            builder.Property(v => v.CoverImageUrl).HasColumnName("cover_image_url").HasMaxLength(2000);
            builder.Property(v => v.ShareUrl).HasColumnName("share_url").HasMaxLength(2000);
            builder.Property(v => v.EmbedLink).HasColumnName("embed_link").HasMaxLength(2000);
            builder.Property(v => v.DurationSeconds).HasColumnName("duration_seconds");
            builder.Property(v => v.ViewCount).HasColumnName("view_count");
            builder.Property(v => v.LikeCount).HasColumnName("like_count");
            builder.Property(v => v.PublishedAt).HasColumnName("published_at").HasColumnType("datetime2");

            builder.Property(v => v.IsHidden).HasColumnName("is_hidden");
            builder.Property(v => v.IsRemoved).HasColumnName("is_removed");

            // حذف المنتج يفك الربط فقط ولا يحذف الفيديو
            builder.Property(v => v.ProductId).HasColumnName("product_id");
            builder.HasOne(v => v.Product)
                .WithMany()
                .HasForeignKey(v => v.ProductId)
                .OnDelete(DeleteBehavior.NoAction);

            builder.Property(v => v.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2");
            builder.Property(v => v.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2");
        }
    }

    public class TikTokOAuthStateConfiguration : IEntityTypeConfiguration<TikTokOAuthState>
    {
        public void Configure(EntityTypeBuilder<TikTokOAuthState> builder)
        {
            builder.ToTable("tiktok_oauth_states");
            builder.HasKey(s => s.State);
            builder.Property(s => s.State).HasColumnName("state").HasMaxLength(100);
            builder.Property(s => s.VendorId).HasColumnName("vendor_id");
            builder.Property(s => s.NonceHash).HasColumnName("nonce_hash").HasMaxLength(100).IsRequired();
            builder.Property(s => s.ExpiresAt).HasColumnName("expires_at").HasColumnType("datetime2");
            builder.Property(s => s.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2");
            builder.HasIndex(s => s.ExpiresAt);
        }
    }

    public class TikTokPostConfiguration : IEntityTypeConfiguration<TikTokPost>
    {
        public void Configure(EntityTypeBuilder<TikTokPost> builder)
        {
            builder.ToTable("tiktok_posts");
            builder.HasKey(p => p.Id);
            builder.Property(p => p.Id).HasColumnName("id");

            builder.Property(p => p.VendorId).HasColumnName("vendor_id");
            builder.HasOne(p => p.Vendor).WithMany().HasForeignKey(p => p.VendorId).OnDelete(DeleteBehavior.Cascade);
            builder.Property(p => p.ProductId).HasColumnName("product_id");
            builder.HasOne(p => p.Product).WithMany().HasForeignKey(p => p.ProductId).OnDelete(DeleteBehavior.NoAction);
            builder.Property(p => p.CreatedByUserId).HasColumnName("created_by_user_id");

            builder.Property(p => p.Caption).HasColumnName("caption").HasMaxLength(2200).IsRequired();
            builder.Property(p => p.SourceMediaJson).HasColumnName("source_media_json").IsRequired();
            builder.Property(p => p.PreparedImagesJson).HasColumnName("prepared_images_json");
            builder.Property(p => p.IsVideo).HasColumnName("is_video");

            builder.Property(p => p.PrivacyLevel).HasColumnName("privacy_level").HasMaxLength(40).IsRequired();
            builder.Property(p => p.AllowComment).HasColumnName("allow_comment");
            builder.Property(p => p.AllowDuet).HasColumnName("allow_duet");
            builder.Property(p => p.AllowStitch).HasColumnName("allow_stitch");
            builder.Property(p => p.PromotesOwnBusiness).HasColumnName("promotes_own_business");

            builder.Property(p => p.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
            builder.Property(p => p.Attempts).HasColumnName("attempts");
            builder.Property(p => p.Error).HasColumnName("error").HasMaxLength(500);
            builder.HasIndex(p => new { p.Status, p.UpdatedAt });
            builder.HasIndex(p => new { p.VendorId, p.CreatedAt });

            builder.Property(p => p.PublishId).HasColumnName("publish_id").HasMaxLength(100);
            builder.Property(p => p.ExternalVideoId).HasColumnName("external_video_id").HasMaxLength(64);
            builder.Property(p => p.PublishedAt).HasColumnName("published_at").HasColumnType("datetime2");
            builder.Property(p => p.ScheduledAt).HasColumnName("scheduled_at").HasColumnType("datetime2");
            builder.Property(p => p.PublishStartedAt).HasColumnName("publish_started_at").HasColumnType("datetime2");
            builder.HasIndex(p => new { p.Status, p.ScheduledAt });

            builder.Property(p => p.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2");
            builder.Property(p => p.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2");
        }
    }
}
