using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class OrderDiscountShares : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "coupon_share",
                table: "sub_orders",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "points_share",
                table: "sub_orders",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "coupon_discount_type",
                table: "orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "coupon_discount_value",
                table: "orders",
                type: "decimal(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "coupon_max_discount",
                table: "orders",
                type: "decimal(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "coupon_original_amount",
                table: "orders",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "points_redeemed_amount",
                table: "orders",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 0m);

            // الطلبات الموجودة: لقطة الكوبون من جدول الكوبونات، ونصيب كل جزء بنفس التوزيع السابق
            // (الكوبون على متجره أو بنسبة المنتجات، والنقاط بنسبة الجزء مع توصيله)
            migrationBuilder.Sql(@"
UPDATE o SET
    coupon_original_amount = CASE WHEN o.discount_amount > o.points_discount_amount THEN o.discount_amount - o.points_discount_amount ELSE 0 END,
    points_redeemed_amount = o.points_discount_amount,
    coupon_discount_type = c.discount_type,
    coupon_discount_value = c.discount_value,
    coupon_max_discount = c.max_discount_amount
FROM orders o LEFT JOIN coupons c ON c.code = o.coupon_code
WHERE o.discount_amount > 0;

WITH a AS (
    SELECT s.id, s.order_id, s.subtotal, s.delivery_fee,
           CASE WHEN o.coupon_vendor_id IS NULL OR s.vendor_id = o.coupon_vendor_id THEN s.subtotal ELSE 0 END AS cw,
           o.coupon_original_amount AS coupon, o.points_redeemed_amount AS pts
    FROM sub_orders s JOIN orders o ON o.id = s.order_id
    WHERE s.status <> 'CANCELLED' AND o.discount_amount > 0
), t AS (
    SELECT *, SUM(cw) OVER (PARTITION BY order_id) AS tcw, SUM(subtotal + delivery_fee) OVER (PARTITION BY order_id) AS tw FROM a
)
UPDATE s SET
    coupon_share = CASE WHEN t.tcw > 0 THEN ROUND(t.coupon * t.cw / t.tcw, 2) ELSE 0 END,
    points_share = CASE WHEN t.tw > 0 THEN ROUND(t.pts * (t.subtotal + t.delivery_fee) / t.tw, 2) ELSE 0 END
FROM sub_orders s JOIN t ON t.id = s.id;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "coupon_share",
                table: "sub_orders");

            migrationBuilder.DropColumn(
                name: "points_share",
                table: "sub_orders");

            migrationBuilder.DropColumn(
                name: "coupon_discount_type",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "coupon_discount_value",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "coupon_max_discount",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "coupon_original_amount",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "points_redeemed_amount",
                table: "orders");
        }
    }
}
