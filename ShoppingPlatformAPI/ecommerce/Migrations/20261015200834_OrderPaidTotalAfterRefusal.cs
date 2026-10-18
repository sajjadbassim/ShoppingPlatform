using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class OrderPaidTotalAfterRefusal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "refusal_fee_waived",
                table: "sub_orders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "original_total_amount",
                table: "orders",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 0m);
        
            // الطلبات الموجودة: «قيمة الطلب عند الشراء» = إجماليها الحالي (كان يبقى بقيمة ما طُلب)،
            // ثم ما فيه رفض عند الباب يصير إجماليه ما دفعه الزبون (ما احتفظ به + الأجرة − الخصم)
            migrationBuilder.Sql(@"
UPDATE orders SET original_total_amount = total_amount;

WITH t AS (
    SELECT s.order_id,
           SUM(s.subtotal - s.refused_amount) AS kept,
           SUM(CASE WHEN s.refusal_fee_waived = 1 THEN 0 ELSE s.delivery_fee END) AS fees,
           SUM(CASE WHEN s.subtotal - s.refused_amount + CASE WHEN s.refusal_fee_waived = 1 THEN 0 ELSE s.delivery_fee END
                         - s.coupon_share - s.points_share > 0
                    THEN s.subtotal - s.refused_amount + CASE WHEN s.refusal_fee_waived = 1 THEN 0 ELSE s.delivery_fee END
                         - s.coupon_share - s.points_share ELSE 0 END) AS due
    FROM sub_orders s
    WHERE s.status NOT IN ('CANCELLED', 'DELIVERY_FAILED')
    GROUP BY s.order_id
    HAVING SUM(s.refused_amount) > 0
)
UPDATE o SET subtotal = t.kept, delivery_fees = t.fees, total_amount = t.due
FROM orders o JOIN t ON t.order_id = o.id;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "refusal_fee_waived",
                table: "sub_orders");

            migrationBuilder.DropColumn(
                name: "original_total_amount",
                table: "orders");
        }
    }
}
