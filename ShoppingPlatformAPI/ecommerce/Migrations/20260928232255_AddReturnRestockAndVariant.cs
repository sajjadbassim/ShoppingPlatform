using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class AddReturnRestockAndVariant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_restocked",
                table: "returns",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "restocked_at",
                table: "returns",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "restocked_by",
                table: "returns",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "variant_id",
                table: "return_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_return_items_variant_id",
                table: "return_items",
                column: "variant_id");

            migrationBuilder.AddForeignKey(
                name: "FK_return_items_product_variants_variant_id",
                table: "return_items",
                column: "variant_id",
                principalTable: "product_variants",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_return_items_product_variants_variant_id",
                table: "return_items");

            migrationBuilder.DropIndex(
                name: "IX_return_items_variant_id",
                table: "return_items");

            migrationBuilder.DropColumn(
                name: "is_restocked",
                table: "returns");

            migrationBuilder.DropColumn(
                name: "restocked_at",
                table: "returns");

            migrationBuilder.DropColumn(
                name: "restocked_by",
                table: "returns");

            migrationBuilder.DropColumn(
                name: "variant_id",
                table: "return_items");
        }
    }
}
