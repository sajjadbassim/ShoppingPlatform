using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class InstagramFullSyncTimestamp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "last_full_synced_at",
                table: "instagram_connections",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "last_full_synced_at",
                table: "instagram_connections");
        }
    }
}
