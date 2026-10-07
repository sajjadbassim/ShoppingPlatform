namespace ecommerce.Core.Models
{
    // عدّاد يومي لأرقام المستندات (ORD-20261005 / RET-20261005) يُحجز منه الرقم التالي ذرياً
    public class NumberSequence
    {
        public string Key { get; set; } = string.Empty;
        public int LastValue { get; set; }
    }
}
