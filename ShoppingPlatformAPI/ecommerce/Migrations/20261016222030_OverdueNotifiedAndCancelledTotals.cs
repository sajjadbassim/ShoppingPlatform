using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class OverdueNotifiedAndCancelledTotals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "confirmation_overdue_notified_at",
                table: "sub_orders",
                type: "datetime2",
                nullable: true);

            // ما تأخر قبل هذا التحديث لا يُرسل له إشعار دفعة واحدة عند أول تشغيل
            migrationBuilder.Sql(@"
UPDATE sub_orders SET confirmation_overdue_notified_at = SYSUTCDATETIME()
WHERE status = 'PENDING_CONFIRMATION' AND confirmation_deadline < SYSUTCDATETIME();");

            // الطلبات الملغاة كلها (بلا نقد مقبوض): قيمتها عند الشراء للسجل ولا دفع مستحق (OrderTotals.SyncCancelled)
            migrationBuilder.Sql(@"
UPDATE o SET
    subtotal = s.sub,
    delivery_fees = s.fees,
    points_discount_amount = o.points_redeemed_amount,
    discount_amount = d.discount,
    total_amount = s.sub + s.fees - d.discount,
    payment_status = 'CANCELLED'
FROM orders o
CROSS APPLY (SELECT SUM(subtotal) AS sub, SUM(delivery_fee) AS fees,
                    SUM(CASE WHEN status <> 'CANCELLED' THEN 1 ELSE 0 END) AS open_parts
             FROM sub_orders WHERE order_id = o.id) s
CROSS APPLY (SELECT CASE WHEN o.coupon_original_amount + o.points_redeemed_amount > s.sub + s.fees
                         THEN s.sub + s.fees ELSE o.coupon_original_amount + o.points_redeemed_amount END AS discount) d
WHERE o.status = 'CANCELLED' AND s.sub IS NOT NULL AND s.open_parts = 0
  AND ISNULL(o.cash_collected_amount, 0) = 0 AND o.payment_status <> 'PAID';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "confirmation_overdue_notified_at",
                table: "sub_orders");
        }
    }
}
