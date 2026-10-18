using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class FeePayerOverrides : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "pickup_fee_override_reason",
                table: "returns",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "refusal_fee_override_at",
                table: "orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "refusal_fee_override_by",
                table: "orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "refusal_fee_override_reason",
                table: "orders",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "refusal_fee_payer_override",
                table: "orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "pickup_fee_override_reason",
                table: "returns");

            migrationBuilder.DropColumn(
                name: "refusal_fee_override_at",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "refusal_fee_override_by",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "refusal_fee_override_reason",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "refusal_fee_payer_override",
                table: "orders");
        }
    }
}
