namespace ecommerce.Core.Constants
{
    // رسالة الكمية للزبون — «فقط 0» كانت مربكة: المخزون الصفر يقال «نفد»
    public static class StockText
    {
        public static string Available(int stock, bool variant = false) => stock <= 0
            ? (variant ? "هذا الخيار نفد من المخزون" : "نفد من المخزون")
            : $"الكمية المتوفرة{(variant ? " من هذا المتغير" : "")} فقط {stock}";
    }
}
