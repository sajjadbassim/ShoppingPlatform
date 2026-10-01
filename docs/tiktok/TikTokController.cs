// ⚠️ ملف مرجعي محفوظ للتكامل مع TikTok لاحقاً — ليس جزءاً من مشروع الـ API ولا يُترجَم.
// يعتمد على النماذج في TikTokModels.cs (نفس المجلد). ملاحظات المواءمة مع المشروع في README.md.

using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace WasitPlatform.TikTok;

[Authorize] // التاجر يجب أن يكون مسجلاً الدخول في منصتك
[Route("tiktok")]
public class TikTokController : Controller
{
    private const string StateCookieName = "tiktok_oauth_state";
    private const string AuthorizeUrl = "https://www.tiktok.com/v2/auth/authorize/";
    private const string TokenUrl = "https://open.tiktokapis.com/v2/oauth/token/";
    private const string UserInfoUrl =
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name";
    private const string Scopes = "user.info.basic,video.list";

    private readonly TikTokOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly AppDbContext _db; // غيّر الاسم إلى DbContext الخاص بمنصتك
    private readonly ILogger<TikTokController> _logger;

    public TikTokController(
        IOptions<TikTokOptions> options,
        IHttpClientFactory httpClientFactory,
        AppDbContext db,
        ILogger<TikTokController> logger)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _db = db;
        _logger = logger;
    }

    // الخطوة 1: زر "ربط تيك توك" يوجّه إلى هنا: /tiktok/connect
    [HttpGet("connect")]
    public IActionResult Connect()
    {
        var state = GenerateState();

        // نحفظ state في كوكي لنتحقق منه عند العودة
        Response.Cookies.Append(StateCookieName, state, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            MaxAge = TimeSpan.FromMinutes(10),
            IsEssential = true
        });

        var url = AuthorizeUrl
            + "?client_key=" + Uri.EscapeDataString(_options.ClientKey)
            + "&scope=" + Uri.EscapeDataString(Scopes)
            + "&response_type=code"
            + "&redirect_uri=" + Uri.EscapeDataString(_options.RedirectUri)
            + "&state=" + Uri.EscapeDataString(state);

        return Redirect(url);
    }

    // الخطوة 2: تيك توك يعيد التاجر إلى هنا: /tiktok/callback?code=...&state=...
    [HttpGet("callback")]
    public async Task<IActionResult> Callback(
        string? code,
        string? state,
        string? error,
        [FromQuery(Name = "error_description")] string? errorDescription,
        CancellationToken ct)
    {
        var expectedState = Request.Cookies[StateCookieName];
        Response.Cookies.Delete(StateCookieName);

        // التاجر ضغط "إلغاء" أو حدث خطأ من جهة تيك توك
        if (!string.IsNullOrEmpty(error))
        {
            _logger.LogWarning("TikTok authorization failed: {Error} {Description}", error, errorDescription);
            return ResultRedirect(false);
        }

        // التحقق من state للحماية من CSRF
        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state) || string.IsNullOrEmpty(expectedState)
            || !CryptographicOperations.FixedTimeEquals(
                   Encoding.UTF8.GetBytes(state), Encoding.UTF8.GetBytes(expectedState)))
        {
            _logger.LogWarning("TikTok callback rejected: missing code or invalid state");
            return ResultRedirect(false);
        }

        var storeId = GetCurrentStoreId();

        // تبديل الكود بتوكن (ASP.NET يفك تشفير الكود تلقائياً)
        var token = await ExchangeCodeAsync(code, ct);
        if (token is null)
            return ResultRedirect(false);

        // جلب الاسم والصورة لعرضهما في لوحة التاجر
        var user = await GetUserInfoAsync(token.AccessToken!, ct);

        // حفظ الربط (أو تحديثه إن كان المتجر مربوطاً سابقاً)
        var now = DateTimeOffset.UtcNow;
        var connection = await _db.TikTokConnections.SingleOrDefaultAsync(c => c.StoreId == storeId, ct);
        if (connection is null)
        {
            connection = new TikTokConnection { StoreId = storeId };
            _db.TikTokConnections.Add(connection);
        }

        connection.OpenId = token.OpenId!;
        connection.AccessToken = token.AccessToken!;
        connection.RefreshToken = token.RefreshToken!;
        connection.AccessTokenExpiresAt = now.AddSeconds(token.ExpiresIn);
        connection.RefreshTokenExpiresAt = now.AddSeconds(token.RefreshExpiresIn);
        connection.Scopes = token.Scope ?? "";
        connection.DisplayName = user?.DisplayName;
        connection.AvatarUrl = user?.AvatarUrl;
        connection.ConnectedAt = now;

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Store {StoreId} connected TikTok account {OpenId}", storeId, connection.OpenId);
        return ResultRedirect(true);
    }

    private async Task<TikTokTokenResponse?> ExchangeCodeAsync(string code, CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient("TikTok");

        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_key"] = _options.ClientKey,
            ["client_secret"] = _options.ClientSecret,
            ["code"] = code,
            ["grant_type"] = "authorization_code",
            ["redirect_uri"] = _options.RedirectUri
        });

        using var response = await client.PostAsync(TokenUrl, content, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        TikTokTokenResponse? token = null;
        try { token = JsonSerializer.Deserialize<TikTokTokenResponse>(body); }
        catch (JsonException) { }

        if (!response.IsSuccessStatusCode || string.IsNullOrEmpty(token?.AccessToken))
        {
            _logger.LogError("TikTok token exchange failed ({Status}): {Error} {Description}",
                (int)response.StatusCode, token?.Error, token?.ErrorDescription);
            return null;
        }

        return token;
    }

    private async Task<TikTokUser?> GetUserInfoAsync(string accessToken, CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient("TikTok");
        using var request = new HttpRequestMessage(HttpMethod.Get, UserInfoUrl);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var response = await client.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        try
        {
            var result = JsonSerializer.Deserialize<TikTokUserInfoResponse>(body);
            if (result?.Error?.Code is { } errCode && errCode != "ok")
            {
                _logger.LogWarning("TikTok user info error: {Code} {Message}", errCode, result.Error.Message);
                return null;
            }
            return result?.Data?.User;
        }
        catch (JsonException)
        {
            _logger.LogWarning("TikTok user info: invalid response ({Status})", (int)response.StatusCode);
            return null;
        }
    }

    // TODO: عدّل هذه الدالة حسب طريقة معرفة متجر المستخدم الحالي في منصتك
    private int GetCurrentStoreId()
    {
        var claim = User.FindFirst("StoreId")?.Value;
        if (int.TryParse(claim, out var storeId))
            return storeId;
        throw new InvalidOperationException("Current user has no store.");
    }

    private IActionResult ResultRedirect(bool success)
    {
        var separator = _options.AfterConnectUrl.Contains('?') ? "&" : "?";
        return Redirect(_options.AfterConnectUrl + separator + "tiktok=" + (success ? "connected" : "error"));
    }

    private static string GenerateState()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
