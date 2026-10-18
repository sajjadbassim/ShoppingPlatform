using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class CustomerReturnPickup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "items_received_at",
                table: "returns",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "pickup_fee_amount",
                table: "returns",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "pickup_fee_payer",
                table: "returns",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "picked_up_at",
                table: "return_trips",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "return_pickup_fee_payer",
                table: "delivery_settings",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "CUSTOMER");

            // أجرة استلام المرتجع تبدأ مثل إعداد أجرة الرفض الحالي
            migrationBuilder.Sql("UPDATE delivery_settings SET return_pickup_fee_payer = refusal_fee_payer;");

            // إرجاعات سابقة: ما اكتمل أو أُعيد للمخزون يُعدّ واصلاً للمتجر. الموافق عليه الذي لم يصل بعد يدخل
            // نظام الاستلام بلا أجرة (قيود المتجر سُجّلت عند موافقته بالنظام القديم ولا تتكرر)
            migrationBuilder.Sql(@"
UPDATE returns SET items_received_at = COALESCE(restocked_at, refunded_at, reviewed_at)
WHERE is_door_refusal = 0 AND (status = 'COMPLETED' OR is_restocked = 1);

UPDATE returns SET pickup_fee_payer = 'NONE', pickup_fee_amount = 0
WHERE is_door_refusal = 0 AND status = 'APPROVED' AND items_received_at IS NULL;");

            migrationBuilder.CreateIndex(
                name: "IX_return_trips_return_id",
                table: "return_trips",
                column: "return_id");

            migrationBuilder.AddForeignKey(
                name: "FK_return_trips_returns_return_id",
                table: "return_trips",
                column: "return_id",
                principalTable: "returns",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_return_trips_returns_return_id",
                table: "return_trips");

            migrationBuilder.DropIndex(
                name: "IX_return_trips_return_id",
                table: "return_trips");

            migrationBuilder.DropColumn(
                name: "items_received_at",
                table: "returns");

            migrationBuilder.DropColumn(
                name: "pickup_fee_amount",
                table: "returns");

            migrationBuilder.DropColumn(
                name: "pickup_fee_payer",
                table: "returns");

            migrationBuilder.DropColumn(
                name: "picked_up_at",
                table: "return_trips");

            migrationBuilder.DropColumn(
                name: "return_pickup_fee_payer",
                table: "delivery_settings");
        }
    }
}
