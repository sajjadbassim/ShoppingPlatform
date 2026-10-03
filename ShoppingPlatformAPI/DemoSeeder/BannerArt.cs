using System.Security;

// رسم بانرات المحاكاة كصور SVG: خلفية متدرجة + صور المنتجات (شفافة الخلفية) + عنوان عربي.
// الصور تُضمَّن داخل الملف (data URI) لأن SVG المعروض عبر <img> لا يحمّل ملفات خارجية.
// Kind: wide (عريض في البلوك) | square (متجاور في البلوك) | header (رأس قسم — بلا نص، العنوان تكتبه الواجهة)
record BannerArt(string Kind, string Title, string Line1, string Line2, string[] Products,
    string Bg1, string Bg2, string Accent, string Dark, string? LinkCategory = null)
{
    private const string Font = "'Segoe UI', Tahoma, 'Geeza Pro', 'Noto Sans Arabic', Arial, sans-serif";

    public string Render(IReadOnlyList<string> imageDataUris) => Kind switch
    {
        "square" => Square(imageDataUris),
        "header" => Header(imageDataUris),
        _ => Wide(imageDataUris),
    };

    private string Wide(IReadOnlyList<string> imgs)
    {
        const int w = 1200, h = 560;
        var body = Circle(250, 300, 260, "#ffffff", 0.35) + Circle(1080, -40, 180, "#ffffff", 0.25)
            + Photos(imgs, new[] { (40, 70, 400), (330, 170, 300), (190, 250, 260) })
            + Text(1130, 255, 96, Accent, Line1) + Text(1130, 350, 58, Dark, Line2)
            + Pill(1130, 400, "تسوّق الآن");
        return Svg(w, h, body);
    }

    private string Square(IReadOnlyList<string> imgs)
    {
        const int w = 800, h = 800;
        var body = Circle(400, 560, 300, "#ffffff", 0.35)
            + Text(400, 150, 88, Accent, Line1, "middle") + Text(400, 235, 58, Dark, Line2, "middle")
            + Photos(imgs, new[] { (150, 270, 500), (430, 420, 320), (60, 470, 280) });
        return Svg(w, h, body);
    }

    private string Header(IReadOnlyList<string> imgs)
    {
        const int w = 1200, h = 520;
        var body = Circle(260, 280, 250, "#ffffff", 0.14) + Circle(700, 560, 220, "#ffffff", 0.08) + Circle(1150, 40, 160, "#ffffff", 0.08)
            + Photos(imgs, new[] { (50, 70, 380), (340, 150, 300), (200, 230, 250) });
        return Svg(w, h, body);
    }

    private string Svg(int w, int h, string body) =>
        $"<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\">" +
        $"<defs><linearGradient id=\"bg\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"{Bg1}\"/><stop offset=\"1\" stop-color=\"{Bg2}\"/></linearGradient></defs>" +
        $"<rect width=\"{w}\" height=\"{h}\" fill=\"url(#bg)\"/>{body}</svg>";

    private static string Circle(int cx, int cy, int r, string color, double opacity) =>
        $"<circle cx=\"{cx}\" cy=\"{cy}\" r=\"{r}\" fill=\"{color}\" opacity=\"{opacity:0.##}\"/>";

    // الصور بترتيب عكسي حتى تكون الأولى (الأهم) في المقدمة، مع ظل بيضاوي خفيف تحت كل صورة
    private static string Photos(IReadOnlyList<string> imgs, (int X, int Y, int Size)[] slots)
    {
        var parts = new List<string>();
        for (var i = Math.Min(imgs.Count, slots.Length) - 1; i >= 0; i--)
        {
            var (x, y, size) = slots[i];
            parts.Add($"<ellipse cx=\"{x + size / 2}\" cy=\"{y + size - size / 14}\" rx=\"{size * 0.36:0}\" ry=\"{size * 0.05:0}\" fill=\"#000\" opacity=\"0.12\"/>");
            parts.Add($"<image href=\"{imgs[i]}\" xlink:href=\"{imgs[i]}\" x=\"{x}\" y=\"{y}\" width=\"{size}\" height=\"{size}\" preserveAspectRatio=\"xMidYMid meet\"/>");
        }
        return string.Concat(parts);
    }

    private static string Text(int x, int y, int size, string color, string text, string anchor = "end") =>
        $"<text x=\"{x}\" y=\"{y}\" font-size=\"{size}\" font-weight=\"800\" fill=\"{color}\" text-anchor=\"{anchor}\" font-family=\"{Font}\">{SecurityElement.Escape(text)}</text>";

    private string Pill(int right, int top, string label)
    {
        const int width = 250, height = 70;
        return $"<rect x=\"{right - width}\" y=\"{top}\" width=\"{width}\" height=\"{height}\" rx=\"35\" fill=\"{Accent}\"/>" +
               Text(right - width / 2, top + 47, 34, "#ffffff", label, "middle");
    }
}
