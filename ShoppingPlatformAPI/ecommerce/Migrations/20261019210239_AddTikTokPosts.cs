using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class AddTikTokPosts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "tiktok_posts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    vendor_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    product_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    caption = table.Column<string>(type: "nvarchar(2200)", maxLength: 2200, nullable: false),
                    source_media_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    prepared_images_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_video = table.Column<bool>(type: "bit", nullable: false),
                    privacy_level = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    allow_comment = table.Column<bool>(type: "bit", nullable: false),
                    allow_duet = table.Column<bool>(type: "bit", nullable: false),
                    allow_stitch = table.Column<bool>(type: "bit", nullable: false),
                    promotes_own_business = table.Column<bool>(type: "bit", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    attempts = table.Column<int>(type: "int", nullable: false),
                    error = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    publish_id = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    external_video_id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    published_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tiktok_posts", x => x.id);
                    table.ForeignKey(
                        name: "FK_tiktok_posts_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_tiktok_posts_vendors_vendor_id",
                        column: x => x.vendor_id,
                        principalTable: "vendors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tiktok_posts_product_id",
                table: "tiktok_posts",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_tiktok_posts_status_updated_at",
                table: "tiktok_posts",
                columns: new[] { "status", "updated_at" });

            migrationBuilder.CreateIndex(
                name: "IX_tiktok_posts_vendor_id_created_at",
                table: "tiktok_posts",
                columns: new[] { "vendor_id", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tiktok_posts");
        }
    }
}
