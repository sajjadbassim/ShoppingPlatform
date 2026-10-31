using System.Net;
using System.Net.Http.Headers;
using ecommerce.Core.Exceptions;

namespace ecommerce.Services.ImageToolsService
{
    // تمرير الصورة كما هي (بلا تصغير) إلى الخدمة الداخلية وإرجاع PNG شفاف. لا شيء يُخزَّن على الخادم
    public class BackgroundRemovalService : IBackgroundRemovalService
    {
        public const string HttpClientName = "bg-remove";
        private readonly IHttpClientFactory _http;
        private readonly ILogger<BackgroundRemovalService> _logger;

        public BackgroundRemovalService(IHttpClientFactory http, ILogger<BackgroundRemovalService> logger)
        {
            _http = http;
            _logger = logger;
        }

        public async Task<BackgroundRemovalResult> RemoveAsync(Stream image, string fileName, string contentType, CancellationToken ct)
        {
            using var form = new MultipartFormDataContent();
            var file = new StreamContent(image);
            file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            form.Add(file, "file", fileName);

            HttpResponseMessage res;
            try
            {
                res = await _http.CreateClient(HttpClientName).PostAsync("/remove", form, ct);
            }
            catch (Exception ex) when (ex is HttpRequestException || (ex is TaskCanceledException && !ct.IsCancellationRequested))
            {
                _logger.LogWarning(ex, "Background removal service unreachable");
                throw new BusinessRuleException("خدمة إزالة الخلفية غير متاحة الآن، حاول بعد قليل");
            }

            using (res)
            {
                if (res.StatusCode == HttpStatusCode.RequestEntityTooLarge)
                    throw new BusinessRuleException("حجم الصورة كبير جداً");
                if (res.StatusCode == HttpStatusCode.UnprocessableEntity)
                    throw new BusinessRuleException("تعذّرت قراءة الصورة، جرّب صورة أخرى");
                if (!res.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Background removal failed with {Status}", (int)res.StatusCode);
                    throw new BusinessRuleException("تعذّرت إزالة الخلفية، حاول مرة أخرى");
                }
                var png = await res.Content.ReadAsByteArrayAsync(ct);
                return new BackgroundRemovalResult(png, Header(res, "X-Queue-Ms"), Header(res, "X-Process-Ms"));
            }
        }

        private static int? Header(HttpResponseMessage res, string name) =>
            res.Headers.TryGetValues(name, out var v) && int.TryParse(v.FirstOrDefault(), out var n) ? n : null;
    }
}
