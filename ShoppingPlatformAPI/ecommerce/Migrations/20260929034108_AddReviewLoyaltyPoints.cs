using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class AddReviewLoyaltyPoints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "reference_key",
                table: "loyalty_transactions",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "review_points",
                table: "loyalty_settings",
                type: "int",
                nullable: false,
                defaultValue: 10); // نفس القيمة الافتراضية في LoyaltySettings حتى يعمل السجل الموجود مباشرة
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "reference_key",
                table: "loyalty_transactions");

            migrationBuilder.DropColumn(
                name: "review_points",
                table: "loyalty_settings");
        }
    }
}
