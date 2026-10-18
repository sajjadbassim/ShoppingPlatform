using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ecommerce.Migrations
{
    /// <inheritdoc />
    public partial class CartUniqueLines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_carts_user_id",
                table: "carts");

            migrationBuilder.DropIndex(
                name: "IX_cart_items_cart_id",
                table: "cart_items");

            // دمج المكرر قبل الفهرس الفريد: سلال الزبون الواحد في أقدمها، وأسطر المنتج الواحد بمجموع كمياتها
            migrationBuilder.Sql(@"
UPDATE ci SET cart_id = k.keep_id
FROM cart_items ci
JOIN (SELECT id, FIRST_VALUE(id) OVER (PARTITION BY user_id ORDER BY created_at, id) AS keep_id FROM carts) k ON k.id = ci.cart_id
WHERE k.keep_id <> k.id;

DELETE c FROM carts c
JOIN (SELECT id, FIRST_VALUE(id) OVER (PARTITION BY user_id ORDER BY created_at, id) AS keep_id FROM carts) k ON k.id = c.id
WHERE k.keep_id <> k.id;

UPDATE ci SET quantity = x.total
FROM cart_items ci
JOIN (SELECT id,
             SUM(quantity) OVER (PARTITION BY cart_id, product_id, variant_id) AS total,
             ROW_NUMBER() OVER (PARTITION BY cart_id, product_id, variant_id ORDER BY created_at, id) AS rn
      FROM cart_items) x ON x.id = ci.id
WHERE x.rn = 1 AND x.total <> ci.quantity;

DELETE ci FROM cart_items ci
JOIN (SELECT id, ROW_NUMBER() OVER (PARTITION BY cart_id, product_id, variant_id ORDER BY created_at, id) AS rn FROM cart_items) x ON x.id = ci.id
WHERE x.rn > 1;");

            migrationBuilder.CreateIndex(
                name: "IX_carts_user_id",
                table: "carts",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_cart_items_cart_product_variant",
                table: "cart_items",
                columns: new[] { "cart_id", "product_id", "variant_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_carts_user_id",
                table: "carts");

            migrationBuilder.DropIndex(
                name: "ux_cart_items_cart_product_variant",
                table: "cart_items");

            migrationBuilder.CreateIndex(
                name: "IX_carts_user_id",
                table: "carts",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_cart_items_cart_id",
                table: "cart_items",
                column: "cart_id");
        }
    }
}
