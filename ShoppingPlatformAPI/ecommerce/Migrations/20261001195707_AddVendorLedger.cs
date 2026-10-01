using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class AddVendorLedger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "commission_type",
                table: "vendors",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "commission_value",
                table: "vendors",
                type: "decimal(12,2)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_door_refusal",
                table: "returns",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "default_commission_type",
                table: "delivery_settings",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "default_commission_value",
                table: "delivery_settings",
                type: "decimal(12,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "vendor_ledger_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    vendor_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(12,2)", nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    sub_order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    return_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vendor_ledger_entries", x => x.id);
                    table.ForeignKey(
                        name: "FK_vendor_ledger_entries_vendors_vendor_id",
                        column: x => x.vendor_id,
                        principalTable: "vendors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "idx_ledger_return_type",
                table: "vendor_ledger_entries",
                columns: new[] { "return_id", "vendor_id", "type" },
                unique: true,
                filter: "[return_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "idx_ledger_suborder_type",
                table: "vendor_ledger_entries",
                columns: new[] { "sub_order_id", "type" },
                unique: true,
                filter: "[sub_order_id] IS NOT NULL AND [return_id] IS NULL");

            migrationBuilder.CreateIndex(
                name: "idx_ledger_vendor_date",
                table: "vendor_ledger_entries",
                columns: new[] { "vendor_id", "created_at" });
        
            // الرفض عند الباب المسجّل سابقاً — لا يُخصم من المتجر (القطع مستثناة من المبيعات أصلاً)
            migrationBuilder.Sql("UPDATE returns SET is_door_refusal = 1 WHERE details LIKE N'رفض عند الاستلام%'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "vendor_ledger_entries");

            migrationBuilder.DropColumn(
                name: "commission_type",
                table: "vendors");

            migrationBuilder.DropColumn(
                name: "commission_value",
                table: "vendors");

            migrationBuilder.DropColumn(
                name: "is_door_refusal",
                table: "returns");

            migrationBuilder.DropColumn(
                name: "default_commission_type",
                table: "delivery_settings");

            migrationBuilder.DropColumn(
                name: "default_commission_value",
                table: "delivery_settings");
        }
    }
}
