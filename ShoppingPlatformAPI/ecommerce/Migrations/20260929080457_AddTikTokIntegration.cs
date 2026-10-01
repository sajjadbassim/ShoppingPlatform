using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class AddTikTokIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "tiktok_connections",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    vendor_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    open_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    access_token_protected = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    refresh_token_protected = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    access_token_expires_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    refresh_token_expires_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    scopes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    display_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    username = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    avatar_url = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    profile_url = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    follower_count = table.Column<long>(type: "bigint", nullable: true),
                    likes_count = table.Column<long>(type: "bigint", nullable: true),
                    video_count = table.Column<long>(type: "bigint", nullable: true),
                    show_on_store = table.Column<bool>(type: "bit", nullable: false),
                    auto_show_new_videos = table.Column<bool>(type: "bit", nullable: false),
                    connected_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    last_synced_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    last_sync_error = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    needs_reconnect = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tiktok_connections", x => x.id);
                    table.ForeignKey(
                        name: "FK_tiktok_connections_vendors_vendor_id",
                        column: x => x.vendor_id,
                        principalTable: "vendors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tiktok_oauth_states",
                columns: table => new
                {
                    state = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    vendor_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    nonce_hash = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    expires_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tiktok_oauth_states", x => x.state);
                });

            migrationBuilder.CreateTable(
                name: "tiktok_videos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    connection_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    external_id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    cover_image_url = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    share_url = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    embed_link = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    duration_seconds = table.Column<int>(type: "int", nullable: true),
                    view_count = table.Column<long>(type: "bigint", nullable: true),
                    like_count = table.Column<long>(type: "bigint", nullable: true),
                    published_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    is_hidden = table.Column<bool>(type: "bit", nullable: false),
                    product_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    is_removed = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tiktok_videos", x => x.id);
                    table.ForeignKey(
                        name: "FK_tiktok_videos_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_tiktok_videos_tiktok_connections_connection_id",
                        column: x => x.connection_id,
                        principalTable: "tiktok_connections",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tiktok_connections_vendor_id",
                table: "tiktok_connections",
                column: "vendor_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tiktok_oauth_states_expires_at",
                table: "tiktok_oauth_states",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "IX_tiktok_videos_connection_id_external_id",
                table: "tiktok_videos",
                columns: new[] { "connection_id", "external_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tiktok_videos_product_id",
                table: "tiktok_videos",
                column: "product_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tiktok_oauth_states");

            migrationBuilder.DropTable(
                name: "tiktok_videos");

            migrationBuilder.DropTable(
                name: "tiktok_connections");
        }
    }
}
