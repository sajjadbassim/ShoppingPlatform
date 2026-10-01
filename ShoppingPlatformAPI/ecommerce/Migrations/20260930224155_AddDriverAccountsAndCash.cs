using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class AddDriverAccountsAndCash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "picked_up_at",
                table: "sub_orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "cash_collected_amount",
                table: "orders",
                type: "decimal(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "cash_collected_at",
                table: "orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "cash_collected_by_driver_id",
                table: "orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "cash_settled_at",
                table: "orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "cash_settled_by",
                table: "orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "user_id",
                table: "drivers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "idx_orders_driver_cash",
                table: "orders",
                columns: new[] { "cash_collected_by_driver_id", "cash_settled_at" });

            migrationBuilder.CreateIndex(
                name: "idx_drivers_user_id",
                table: "drivers",
                column: "user_id",
                unique: true,
                filter: "[user_id] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_drivers_users_user_id",
                table: "drivers",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_drivers_users_user_id",
                table: "drivers");

            migrationBuilder.DropIndex(
                name: "idx_orders_driver_cash",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "idx_drivers_user_id",
                table: "drivers");

            migrationBuilder.DropColumn(
                name: "picked_up_at",
                table: "sub_orders");

            migrationBuilder.DropColumn(
                name: "cash_collected_amount",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "cash_collected_at",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "cash_collected_by_driver_id",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "cash_settled_at",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "cash_settled_by",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "user_id",
                table: "drivers");
        }
    }
}
