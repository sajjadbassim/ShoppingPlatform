using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class HomeBannerBlocks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "banner_image_url",
                table: "home_sections",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "section_id",
                table: "banners",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_banners_section_id",
                table: "banners",
                column: "section_id");

            migrationBuilder.AddForeignKey(
                name: "FK_banners_home_sections_section_id",
                table: "banners",
                column: "section_id",
                principalTable: "home_sections",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_banners_home_sections_section_id",
                table: "banners");

            migrationBuilder.DropIndex(
                name: "IX_banners_section_id",
                table: "banners");

            migrationBuilder.DropColumn(
                name: "banner_image_url",
                table: "home_sections");

            migrationBuilder.DropColumn(
                name: "section_id",
                table: "banners");
        }
    }
}
