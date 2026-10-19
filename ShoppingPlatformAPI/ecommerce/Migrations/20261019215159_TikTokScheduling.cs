using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class TikTokScheduling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "publish_started_at",
                table: "tiktok_posts",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "scheduled_at",
                table: "tiktok_posts",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_tiktok_posts_status_scheduled_at",
                table: "tiktok_posts",
                columns: new[] { "status", "scheduled_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tiktok_posts_status_scheduled_at",
                table: "tiktok_posts");

            migrationBuilder.DropColumn(
                name: "publish_started_at",
                table: "tiktok_posts");

            migrationBuilder.DropColumn(
                name: "scheduled_at",
                table: "tiktok_posts");
        }
    }
}
