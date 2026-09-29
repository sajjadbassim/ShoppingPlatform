using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class AddUserPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_preferences",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    language = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    theme = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    notify_order_updates = table.Column<bool>(type: "bit", nullable: false),
                    notify_new_orders = table.Column<bool>(type: "bit", nullable: false),
                    notify_order_confirmations = table.Column<bool>(type: "bit", nullable: false),
                    notify_low_stock = table.Column<bool>(type: "bit", nullable: false),
                    notify_reviews = table.Column<bool>(type: "bit", nullable: false),
                    notify_returns = table.Column<bool>(type: "bit", nullable: false),
                    notify_new_users = table.Column<bool>(type: "bit", nullable: false),
                    notify_new_vendors = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_preferences", x => x.user_id);
                    table.ForeignKey(
                        name: "FK_user_preferences_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_preferences");
        }
    }
}
