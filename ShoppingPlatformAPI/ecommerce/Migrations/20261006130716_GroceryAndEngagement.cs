using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class GroceryAndEngagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "referral_code",
                table: "users",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "referral_rewarded_at",
                table: "users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "referred_by_user_id",
                table: "users",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "notify_reminders",
                table: "user_preferences",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<Guid>(
                name: "replaces_item_id",
                table: "sub_order_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "weight_step_kg",
                table: "sub_order_items",
                type: "decimal(6,3)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "weight_step_kg",
                table: "products",
                type: "decimal(6,3)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "delivery_slot_end",
                table: "orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "delivery_slot_start",
                table: "orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "substitution_preference",
                table: "orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "referral_points",
                table: "loyalty_settings",
                type: "int",
                nullable: false,
                defaultValue: 200);

            migrationBuilder.AddColumn<DateTime>(
                name: "ends_at",
                table: "home_sections",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "grocery_slot_days",
                table: "delivery_settings",
                type: "int",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.AddColumn<int>(
                name: "grocery_slot_end_hour",
                table: "delivery_settings",
                type: "int",
                nullable: false,
                defaultValue: 22);

            migrationBuilder.AddColumn<int>(
                name: "grocery_slot_lead_minutes",
                table: "delivery_settings",
                type: "int",
                nullable: false,
                defaultValue: 60);

            migrationBuilder.AddColumn<int>(
                name: "grocery_slot_minutes",
                table: "delivery_settings",
                type: "int",
                nullable: false,
                defaultValue: 120);

            migrationBuilder.AddColumn<int>(
                name: "grocery_slot_start_hour",
                table: "delivery_settings",
                type: "int",
                nullable: false,
                defaultValue: 10);

            migrationBuilder.AddColumn<bool>(
                name: "grocery_slots_enabled",
                table: "delivery_settings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "reminder_sent_at",
                table: "carts",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "stock_alerts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    product_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    variant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    notified_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_alerts", x => x.id);
                    table.ForeignKey(
                        name: "FK_stock_alerts_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_stock_alerts_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_users_referral_code",
                table: "users",
                column: "referral_code",
                unique: true,
                filter: "[referral_code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "idx_users_referred_by",
                table: "users",
                column: "referred_by_user_id");

            migrationBuilder.CreateIndex(
                name: "idx_stock_alerts_notified_at",
                table: "stock_alerts",
                column: "notified_at");

            migrationBuilder.CreateIndex(
                name: "idx_stock_alerts_user_product",
                table: "stock_alerts",
                columns: new[] { "user_id", "product_id" });

            migrationBuilder.CreateIndex(
                name: "IX_stock_alerts_product_id",
                table: "stock_alerts",
                column: "product_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "stock_alerts");

            migrationBuilder.DropIndex(
                name: "idx_users_referral_code",
                table: "users");

            migrationBuilder.DropIndex(
                name: "idx_users_referred_by",
                table: "users");

            migrationBuilder.DropColumn(
                name: "referral_code",
                table: "users");

            migrationBuilder.DropColumn(
                name: "referral_rewarded_at",
                table: "users");

            migrationBuilder.DropColumn(
                name: "referred_by_user_id",
                table: "users");

            migrationBuilder.DropColumn(
                name: "notify_reminders",
                table: "user_preferences");

            migrationBuilder.DropColumn(
                name: "replaces_item_id",
                table: "sub_order_items");

            migrationBuilder.DropColumn(
                name: "weight_step_kg",
                table: "sub_order_items");

            migrationBuilder.DropColumn(
                name: "weight_step_kg",
                table: "products");

            migrationBuilder.DropColumn(
                name: "delivery_slot_end",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "delivery_slot_start",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "substitution_preference",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "referral_points",
                table: "loyalty_settings");

            migrationBuilder.DropColumn(
                name: "ends_at",
                table: "home_sections");

            migrationBuilder.DropColumn(
                name: "grocery_slot_days",
                table: "delivery_settings");

            migrationBuilder.DropColumn(
                name: "grocery_slot_end_hour",
                table: "delivery_settings");

            migrationBuilder.DropColumn(
                name: "grocery_slot_lead_minutes",
                table: "delivery_settings");

            migrationBuilder.DropColumn(
                name: "grocery_slot_minutes",
                table: "delivery_settings");

            migrationBuilder.DropColumn(
                name: "grocery_slot_start_hour",
                table: "delivery_settings");

            migrationBuilder.DropColumn(
                name: "grocery_slots_enabled",
                table: "delivery_settings");

            migrationBuilder.DropColumn(
                name: "reminder_sent_at",
                table: "carts");
        }
    }
}
