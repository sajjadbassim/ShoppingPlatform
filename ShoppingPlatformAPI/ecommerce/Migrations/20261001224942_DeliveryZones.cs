using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryZones : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "use_delivery_zones",
                table: "vendors",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "delivery_zone_id",
                table: "orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "delivery_zone_name",
                table: "orders",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "zones_mode",
                table: "delivery_settings",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "zone_id",
                table: "addresses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "delivery_zones",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    fee = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_delivery_zones", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_addresses_zone_id",
                table: "addresses",
                column: "zone_id");

            migrationBuilder.CreateIndex(
                name: "idx_delivery_zones_name",
                table: "delivery_zones",
                column: "name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_addresses_delivery_zones_zone_id",
                table: "addresses",
                column: "zone_id",
                principalTable: "delivery_zones",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_addresses_delivery_zones_zone_id",
                table: "addresses");

            migrationBuilder.DropTable(
                name: "delivery_zones");

            migrationBuilder.DropIndex(
                name: "IX_addresses_zone_id",
                table: "addresses");

            migrationBuilder.DropColumn(
                name: "use_delivery_zones",
                table: "vendors");

            migrationBuilder.DropColumn(
                name: "delivery_zone_id",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "delivery_zone_name",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "zones_mode",
                table: "delivery_settings");

            migrationBuilder.DropColumn(
                name: "zone_id",
                table: "addresses");
        }
    }
}
