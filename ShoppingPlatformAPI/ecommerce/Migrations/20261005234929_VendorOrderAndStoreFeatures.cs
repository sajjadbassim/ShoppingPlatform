using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class VendorOrderAndStoreFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_accepting_orders",
                table: "vendors",
                type: "bit",
                nullable: false,
                // المتاجر الحالية تبقى تستقبل الطلبات
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "working_hours",
                table: "vendors",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "unavailable_quantity",
                table: "sub_order_items",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerVendorId",
                table: "promotions",
                type: "uniqueidentifier",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_accepting_orders",
                table: "vendors");

            migrationBuilder.DropColumn(
                name: "working_hours",
                table: "vendors");

            migrationBuilder.DropColumn(
                name: "unavailable_quantity",
                table: "sub_order_items");

            migrationBuilder.DropColumn(
                name: "OwnerVendorId",
                table: "promotions");
        }
    }
}
