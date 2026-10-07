using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class SupermarketSection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "page",
                table: "home_sections",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "general");

            migrationBuilder.AddColumn<bool>(
                name: "is_grocery",
                table: "categories",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "page",
                table: "banners",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "general");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "page",
                table: "home_sections");

            migrationBuilder.DropColumn(
                name: "is_grocery",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "page",
                table: "banners");
        }
    }
}
