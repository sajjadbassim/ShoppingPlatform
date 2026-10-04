using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class AddFacebookIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "facebook_connections",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    vendor_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    facebook_user_id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    page_id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    page_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    page_username = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    page_picture_url = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    page_link = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    followers_count = table.Column<long>(type: "bigint", nullable: true),
                    page_access_token_protected = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    scopes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    show_on_store = table.Column<bool>(type: "bit", nullable: false),
                    auto_show_new_media = table.Column<bool>(type: "bit", nullable: false),
                    connected_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    last_synced_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    last_full_synced_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    last_sync_error = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    needs_reconnect = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_facebook_connections", x => x.id);
                    table.ForeignKey(
                        name: "FK_facebook_connections_vendors_vendor_id",
                        column: x => x.vendor_id,
                        principalTable: "vendors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "facebook_oauth_states",
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
                    table.PrimaryKey("PK_facebook_oauth_states", x => x.state);
                });

            migrationBuilder.CreateTable(
                name: "facebook_media",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    connection_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    external_id = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    media_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    is_reel = table.Column<bool>(type: "bit", nullable: false),
                    caption = table.Column<string>(type: "nvarchar(2200)", maxLength: 2200, nullable: true),
                    media_url = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    thumbnail_url = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    permalink = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    duration_seconds = table.Column<int>(type: "int", nullable: true),
                    children_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    published_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    is_hidden = table.Column<bool>(type: "bit", nullable: false),
                    product_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    is_removed = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_facebook_media", x => x.id);
                    table.ForeignKey(
                        name: "FK_facebook_media_facebook_connections_connection_id",
                        column: x => x.connection_id,
                        principalTable: "facebook_connections",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_facebook_media_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_facebook_connections_facebook_user_id",
                table: "facebook_connections",
                column: "facebook_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_facebook_connections_vendor_id",
                table: "facebook_connections",
                column: "vendor_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_facebook_media_connection_id_external_id",
                table: "facebook_media",
                columns: new[] { "connection_id", "external_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_facebook_media_product_id",
                table: "facebook_media",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_facebook_oauth_states_expires_at",
                table: "facebook_oauth_states",
                column: "expires_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "facebook_media");

            migrationBuilder.DropTable(
                name: "facebook_oauth_states");

            migrationBuilder.DropTable(
                name: "facebook_connections");
        }
    }
}
