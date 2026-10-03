using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class AddInstagramIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "instagram_connections",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    vendor_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    instagram_user_id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    account_id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    access_token_protected = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    access_token_issued_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    access_token_expires_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    scopes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    username = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    account_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    profile_picture_url = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    followers_count = table.Column<long>(type: "bigint", nullable: true),
                    media_count = table.Column<long>(type: "bigint", nullable: true),
                    show_on_store = table.Column<bool>(type: "bit", nullable: false),
                    auto_show_new_media = table.Column<bool>(type: "bit", nullable: false),
                    connected_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    last_synced_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    last_sync_error = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    needs_reconnect = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_instagram_connections", x => x.id);
                    table.ForeignKey(
                        name: "FK_instagram_connections_vendors_vendor_id",
                        column: x => x.vendor_id,
                        principalTable: "vendors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "instagram_oauth_states",
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
                    table.PrimaryKey("PK_instagram_oauth_states", x => x.state);
                });

            migrationBuilder.CreateTable(
                name: "instagram_media",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    connection_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    external_id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    media_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    media_product_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    caption = table.Column<string>(type: "nvarchar(2200)", maxLength: 2200, nullable: true),
                    media_url = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    thumbnail_url = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    permalink = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    children_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    like_count = table.Column<long>(type: "bigint", nullable: true),
                    comments_count = table.Column<long>(type: "bigint", nullable: true),
                    published_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    is_hidden = table.Column<bool>(type: "bit", nullable: false),
                    product_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    is_removed = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_instagram_media", x => x.id);
                    table.ForeignKey(
                        name: "FK_instagram_media_instagram_connections_connection_id",
                        column: x => x.connection_id,
                        principalTable: "instagram_connections",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_instagram_media_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_instagram_connections_instagram_user_id",
                table: "instagram_connections",
                column: "instagram_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_instagram_connections_vendor_id",
                table: "instagram_connections",
                column: "vendor_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_instagram_media_connection_id_external_id",
                table: "instagram_media",
                columns: new[] { "connection_id", "external_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_instagram_media_product_id",
                table: "instagram_media",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_instagram_oauth_states_expires_at",
                table: "instagram_oauth_states",
                column: "expires_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "instagram_media");

            migrationBuilder.DropTable(
                name: "instagram_oauth_states");

            migrationBuilder.DropTable(
                name: "instagram_connections");
        }
    }
}
