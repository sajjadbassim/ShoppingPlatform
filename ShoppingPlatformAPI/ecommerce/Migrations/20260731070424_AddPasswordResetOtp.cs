using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordResetOtp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "password_reset_otps",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code_hash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    expires_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    attempts = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    is_verified = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    reset_token = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    reset_token_expires_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    is_used = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_password_reset_otps", x => x.id);
                    table.ForeignKey(
                        name: "FK_password_reset_otps_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_password_reset_otps_reset_token",
                table: "password_reset_otps",
                column: "reset_token");

            migrationBuilder.CreateIndex(
                name: "idx_password_reset_otps_user_id",
                table: "password_reset_otps",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "password_reset_otps");
        }
    }
}
