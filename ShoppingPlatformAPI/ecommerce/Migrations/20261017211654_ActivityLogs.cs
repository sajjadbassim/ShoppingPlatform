using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class ActivityLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "activity_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    actor_role = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    actor_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    actor_vendor_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    action = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    kind = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    summary = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    vendor_ids = table.Column<string>(type: "nvarchar(800)", maxLength: 800, nullable: true),
                    details = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    http_method = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    path = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    ip = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    user_agent = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_activity_logs", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_activity_logs_actor_user_id_at",
                table: "activity_logs",
                columns: new[] { "actor_user_id", "at" });

            migrationBuilder.CreateIndex(
                name: "IX_activity_logs_actor_vendor_id_at",
                table: "activity_logs",
                columns: new[] { "actor_vendor_id", "at" });

            migrationBuilder.CreateIndex(
                name: "IX_activity_logs_at",
                table: "activity_logs",
                column: "at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "activity_logs");
        }
    }
}
