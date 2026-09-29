using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class AddVendorOwnerId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "owner_id",
                table: "vendors",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_vendors_owner_id",
                table: "vendors",
                column: "owner_id");

            migrationBuilder.AddForeignKey(
                name: "FK_vendors_users_owner_id",
                table: "vendors",
                column: "owner_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_vendors_users_owner_id",
                table: "vendors");

            migrationBuilder.DropIndex(
                name: "IX_vendors_owner_id",
                table: "vendors");

            migrationBuilder.DropColumn(
                name: "owner_id",
                table: "vendors");
        }
    }
}
