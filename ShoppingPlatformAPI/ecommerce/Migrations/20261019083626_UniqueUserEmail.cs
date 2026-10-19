using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class UniqueUserEmail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "idx_users_email",
                table: "users");

            migrationBuilder.CreateIndex(
                name: "idx_users_email",
                table: "users",
                column: "email",
                unique: true,
                filter: "[email] IS NOT NULL AND [email] <> ''");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "idx_users_email",
                table: "users");

            migrationBuilder.CreateIndex(
                name: "idx_users_email",
                table: "users",
                column: "email");
        }
    }
}
