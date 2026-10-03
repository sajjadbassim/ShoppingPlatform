using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class ProductSoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "products",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "products",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "products");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "products");
        }
    }
}
