using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class SubOrderRefusedAmount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "refused_amount",
                table: "sub_orders",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 0m);

            // الطلبات الموجودة: قيمة ما رُفض عند الباب من بنودها
            migrationBuilder.Sql(@"
UPDATE s SET refused_amount = x.v
FROM sub_orders s
JOIN (SELECT sub_order_id, SUM(unit_price * refused_quantity) AS v FROM sub_order_items WHERE refused_quantity > 0 GROUP BY sub_order_id) x
  ON x.sub_order_id = s.id;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "refused_amount",
                table: "sub_orders");
        }
    }
}
