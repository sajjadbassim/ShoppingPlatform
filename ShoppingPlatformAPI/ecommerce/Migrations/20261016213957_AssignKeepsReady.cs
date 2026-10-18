using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class AssignKeepsReady : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // التعيين صار يُبقي الجزء «جاهز للاستلام» حتى يستلمه السائق: الأجزاء المعيَّنة التي لم تُستلم بعد تعود «جاهز»،
            // والطلب الذي فيه جزء «جاهز» (ولم يخرج كله) لم يعد «في الطريق»
            migrationBuilder.Sql(@"
UPDATE sub_orders SET status = 'READY', updated_at = SYSUTCDATETIME()
WHERE status = 'OUT_FOR_DELIVERY' AND picked_up_at IS NULL AND driver_id IS NOT NULL;

UPDATE o SET status = 'READY', updated_at = SYSUTCDATETIME()
FROM orders o
WHERE o.status = 'OUT_FOR_DELIVERY'
  AND EXISTS (SELECT 1 FROM sub_orders s WHERE s.order_id = o.id AND s.status = 'READY');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
