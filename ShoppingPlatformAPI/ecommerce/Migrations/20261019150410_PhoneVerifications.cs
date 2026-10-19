using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class PhoneVerifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "phone_verifications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    phone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    code_hash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    expires_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    attempts = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    token_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    token_expires_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    used_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_phone_verifications", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "idx_phone_verifications_phone",
                table: "phone_verifications",
                column: "phone");

            migrationBuilder.CreateIndex(
                name: "idx_phone_verifications_token_hash",
                table: "phone_verifications",
                column: "token_hash");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "phone_verifications");
        }
    }
}
