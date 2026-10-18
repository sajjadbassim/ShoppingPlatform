using ecommerce.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ecommerce.Data.Configurations
{
    // سلة واحدة لكل زبون
    public class CartConfiguration : IEntityTypeConfiguration<Cart>
    {
        public void Configure(EntityTypeBuilder<Cart> entity)
        {
            entity.HasIndex(e => e.UserId).IsUnique();
        }
    }

    // سطر واحد لكل منتج/متغير في السلة: الإضافات المتزامنة كانت تُنشئ أسطراً مكررة تتجاوز المخزون معاً.
    // بلا مرشّح: المنتج بلا متغير (variant_id = NULL) يبقى سطراً واحداً أيضاً
    public class CartItemConfiguration : IEntityTypeConfiguration<CartItem>
    {
        public void Configure(EntityTypeBuilder<CartItem> entity)
        {
            entity.HasIndex(e => new { e.CartId, e.ProductId, e.VariantId })
                .IsUnique()
                .HasFilter(null)
                .HasDatabaseName("ux_cart_items_cart_product_variant");
        }
    }
}
