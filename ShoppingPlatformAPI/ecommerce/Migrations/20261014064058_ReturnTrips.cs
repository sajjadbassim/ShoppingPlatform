using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class ReturnTrips : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "return_trips",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sub_order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    vendor_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    driver_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    return_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    reason = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    delivery_fee = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    received_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    received_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_return_trips", x => x.id);
                    table.ForeignKey(
                        name: "FK_return_trips_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "drivers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_return_trips_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_return_trips_sub_orders_sub_order_id",
                        column: x => x.sub_order_id,
                        principalTable: "sub_orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_return_trips_vendors_vendor_id",
                        column: x => x.vendor_id,
                        principalTable: "vendors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "return_trip_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    return_trip_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sub_order_item_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    product_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    variant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    product_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    quantity = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_return_trip_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_return_trip_items_return_trips_return_trip_id",
                        column: x => x.return_trip_id,
                        principalTable: "return_trips",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_return_trip_items_return_trip_id",
                table: "return_trip_items",
                column: "return_trip_id");

            migrationBuilder.CreateIndex(
                name: "idx_return_trips_driver_status",
                table: "return_trips",
                columns: new[] { "driver_id", "status" });

            migrationBuilder.CreateIndex(
                name: "idx_return_trips_suborder",
                table: "return_trips",
                column: "sub_order_id");

            migrationBuilder.CreateIndex(
                name: "idx_return_trips_vendor_status",
                table: "return_trips",
                columns: new[] { "vendor_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_return_trips_order_id",
                table: "return_trips",
                column: "order_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "return_trip_items");

            migrationBuilder.DropTable(
                name: "return_trips");
        }
    }
}
