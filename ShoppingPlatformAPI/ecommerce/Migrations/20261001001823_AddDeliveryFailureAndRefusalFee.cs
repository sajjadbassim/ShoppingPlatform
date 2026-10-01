using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class AddDeliveryFailureAndRefusalFee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "failed_at",
                table: "sub_orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "failure_note",
                table: "sub_orders",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "failure_reason",
                table: "sub_orders",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "refusal_fee_amount",
                table: "orders",
                type: "decimal(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "refusal_fee_payer",
                table: "orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "delivery_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    refusal_fee_payer = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_delivery_settings", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "delivery_settings");

            migrationBuilder.DropColumn(
                name: "failed_at",
                table: "sub_orders");

            migrationBuilder.DropColumn(
                name: "failure_note",
                table: "sub_orders");

            migrationBuilder.DropColumn(
                name: "failure_reason",
                table: "sub_orders");

            migrationBuilder.DropColumn(
                name: "refusal_fee_amount",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "refusal_fee_payer",
                table: "orders");
        }
    }
}
