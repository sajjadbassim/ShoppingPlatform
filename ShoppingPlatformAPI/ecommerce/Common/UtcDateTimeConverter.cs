using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ecommerce.Common
{
    // كل الأوقات تُخزَّن بتوقيت UTC، لكن EF يعيدها بلا نوع فتُرسَل بلا «Z» فيقرؤها المتصفح كتوقيت محلي
    // (فرق 3 ساعات في العراق: «منذ 3 س» لطلب عمره دقيقة). نُرسلها دائماً بعلامة UTC صريحة.
    public class UtcDateTimeConverter : JsonConverter<DateTime>
    {
        public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            => reader.GetDateTime();

        public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
        {
            var utc = value.Kind switch
            {
                DateTimeKind.Local => value.ToUniversalTime(),
                DateTimeKind.Unspecified => DateTime.SpecifyKind(value, DateTimeKind.Utc),
                _ => value,
            };
            writer.WriteStringValue(utc.ToString("yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'", CultureInfo.InvariantCulture));
        }
    }
}
