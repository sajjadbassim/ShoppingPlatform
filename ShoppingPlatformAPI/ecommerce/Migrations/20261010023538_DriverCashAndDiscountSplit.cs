using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class DriverCashAndDiscountSplit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "coupon_vendor_id",
                table: "orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "points_discount_amount",
                table: "orders",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "driver_cash_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    driver_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    amount = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    collected_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    settled_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    settled_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driver_cash_entries", x => x.id);
                    table.ForeignKey(
                        name: "FK_driver_cash_entries_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "drivers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driver_cash_entries_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_driver_cash_driver_settled",
                table: "driver_cash_entries",
                columns: new[] { "driver_id", "settled_at" });

            migrationBuilder.CreateIndex(
                name: "idx_driver_cash_order",
                table: "driver_cash_entries",
                column: "order_id");

            // البيانات الحالية: متجر الكوبون، وجزء النقاط من الخصم، ونقد كل طلب على السائق الذي سُجّل عليه
            migrationBuilder.Sql(@"
UPDATE o SET coupon_vendor_id = c.vendor_id
FROM orders o JOIN coupons c ON c.code = o.coupon_code
WHERE o.discount_amount > 0 AND c.vendor_id IS NOT NULL;

UPDATE o SET points_discount_amount = CASE WHEN x.d > o.discount_amount THEN o.discount_amount ELSE x.d END
FROM orders o JOIN (
    SELECT t.order_id, ROUND(SUM(-t.points) * ISNULL((SELECT TOP 1 point_value FROM loyalty_settings), 0), 2) AS d
    FROM loyalty_transactions t WHERE t.type = 'redeemed' AND t.order_id IS NOT NULL GROUP BY t.order_id
) x ON x.order_id = o.id;

INSERT INTO driver_cash_entries (id, order_id, driver_id, amount, kind, collected_at, settled_at, settled_by)
SELECT NEWID(), o.id, o.cash_collected_by_driver_id, o.cash_collected_amount, 'DELIVERY',
       COALESCE(o.cash_collected_at, o.updated_at), o.cash_settled_at, o.cash_settled_by
FROM orders o
WHERE o.cash_collected_by_driver_id IS NOT NULL AND o.cash_collected_amount > 0
  AND EXISTS (SELECT 1 FROM drivers d WHERE d.id = o.cash_collected_by_driver_id);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "driver_cash_entries");

            migrationBuilder.DropColumn(
                name: "coupon_vendor_id",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "points_discount_amount",
                table: "orders");
        }
    }
}
