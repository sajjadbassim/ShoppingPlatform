using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class AddDriverLiveLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "last_latitude",
                table: "drivers",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "last_location_accuracy",
                table: "drivers",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "last_location_at",
                table: "drivers",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "last_longitude",
                table: "drivers",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "location_token_hash",
                table: "drivers",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_drivers_location_token_hash",
                table: "drivers",
                column: "location_token_hash",
                unique: true,
                filter: "[location_token_hash] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_drivers_location_token_hash",
                table: "drivers");

            migrationBuilder.DropColumn(
                name: "last_latitude",
                table: "drivers");

            migrationBuilder.DropColumn(
                name: "last_location_accuracy",
                table: "drivers");

            migrationBuilder.DropColumn(
                name: "last_location_at",
                table: "drivers");

            migrationBuilder.DropColumn(
                name: "last_longitude",
                table: "drivers");

            migrationBuilder.DropColumn(
                name: "location_token_hash",
                table: "drivers");
        }
    }
}
