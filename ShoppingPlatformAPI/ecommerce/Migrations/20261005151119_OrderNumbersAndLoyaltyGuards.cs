using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class OrderNumbersAndLoyaltyGuards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "number_sequences",
                columns: table => new
                {
                    key = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    last_value = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_number_sequences", x => x.key);
                });

            migrationBuilder.CreateIndex(
                name: "idx_loyalty_transactions_reference",
                table: "loyalty_transactions",
                columns: new[] { "account_id", "reference_key" },
                unique: true,
                filter: "[reference_key] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "number_sequences");

            migrationBuilder.DropIndex(
                name: "idx_loyalty_transactions_reference",
                table: "loyalty_transactions");
        }
    }
}
