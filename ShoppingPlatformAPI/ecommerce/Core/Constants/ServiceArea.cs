namespace ecommerce.Core.Constants
{
    // نطاق خدمة التوصيل: محافظة واسط فقط. دبوس خارجها يُرفض عند حفظ العنوان وعند إرسال الطلب، بدل أن يُنشأ
    // طلب لا يمكن توصيله ثم تلغيه العمليات. الحدود تقريبية (مضلّع حول المحافظة: الكوت، الصويرة، العزيزية،
    // النعمانية، بدرة وزرباطية، الحي، الشيخ سعد) — ما يقع على الحدود تماماً قد يُحكم عليه بفارق بسيط
    public static class ServiceArea
    {
        public const string Name = "محافظة واسط";

        public const string OutsideMessage = "الموقع خارج منطقة التوصيل — نوصل داخل محافظة واسط فقط";

        // (خط العرض، خط الطول) باتجاه عقارب الساعة من الشمال الغربي
        private static readonly (double Lat, double Lng)[] Polygon =
        {
            (33.10, 44.65), (33.30, 45.10), (33.40, 45.60), (33.30, 45.90), (33.15, 46.15),
            (32.95, 46.25), (32.65, 46.55), (32.30, 46.50), (32.05, 46.35), (32.00, 45.80),
            (32.10, 45.30), (32.40, 44.95), (32.70, 44.60),
        };

        // عنوان بلا دبوس لا يُحكم عليه (العنوان النصي فقط)
        public static bool Covers(decimal? lat, decimal? lng)
            => lat == null || lng == null || Contains((double)lat.Value, (double)lng.Value);

        // نقطة داخل المضلع (تقاطع شعاع أفقي مع الأضلاع)
        private static bool Contains(double lat, double lng)
        {
            var inside = false;
            for (int i = 0, j = Polygon.Length - 1; i < Polygon.Length; j = i++)
            {
                var (latI, lngI) = Polygon[i];
                var (latJ, lngJ) = Polygon[j];
                if ((latI > lat) != (latJ > lat) && lng < (lngJ - lngI) * (lat - latI) / (latJ - latI) + lngI)
                    inside = !inside;
            }
            return inside;
        }
    }
}
