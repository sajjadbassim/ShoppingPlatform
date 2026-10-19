using Serilog;
using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Extensions;
using ecommerce.Filters;
using ecommerce.Hubs;
using ecommerce.Repositories;
using ecommerce.Services;
using ecommerce.Services.AdminService;
using ecommerce.Services.AuthService;
using ecommerce.Services.FileService;
using ecommerce.Services.HomeService;
using ecommerce.Services.InventoryService;
using ecommerce.Services.InvoiceService;
using ecommerce.Services.LoyaltyService;
using ecommerce.Services.NotificationService;
using ecommerce.Services.OrderRatingService;
using ecommerce.Services.ProductService;
using ecommerce.Services.ProductService.ProductService;
using ecommerce.Services.SmsService;
using ecommerce.Services.UserPreferencesService;
using ecommerce.Services.VendorService.VendorService;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ===================================
// السجلات: الشاشة + ملف يومي دائم (logs/api-YYYYMMDD.log، آخر 30 يوماً)
// الملف يحفظ التحذيرات والأخطاء فقط حتى يبقى صغيراً وسهل القراءة
// ===================================
builder.Host.UseSerilog((ctx, cfg) => cfg
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", Serilog.Events.LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", Serilog.Events.LogEventLevel.Warning)
    .MinimumLevel.Override("System", Serilog.Events.LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File(
        Path.Combine(ctx.HostingEnvironment.ContentRootPath, "logs", "api-.log"),
        restrictedToMinimumLevel: Serilog.Events.LogEventLevel.Warning,
        rollingInterval: Serilog.RollingInterval.Day,
        retainedFileCountLimit: 30,
        encoding: System.Text.Encoding.UTF8,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss} [{Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}"));

// فحص الحالة: الخادم + قاعدة البيانات — /health
builder.Services.AddHealthChecks().AddCheck<ecommerce.Common.DatabaseHealthCheck>("database");

// Add services to the container.

builder.Services.AddControllers(options =>
{
    var policy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();

    options.Filters.Add(new AuthorizeFilter(policy));
    options.Filters.Add(new ecommerce.Filters.PagingClampFilter());
    // صلاحيات موظفي المتاجر والمسؤولين المحدودين (قبل أي إجراء)
    // قبل التحقق من صحة الطلب (ModelStateInvalidFilter = -2000): من لا يملك الصلاحية يُرفض قبل أي شيء
    options.Filters.Add<ecommerce.Filters.StaffPermissionFilter>(-3000);
    // سجل النشاط لكل الأدوار عدا الزبون
    options.Filters.Add<ecommerce.Filters.ActivityLogFilter>();
})
.AddJsonOptions(o =>
{
    o.JsonSerializerOptions.Converters.Add(new ecommerce.Common.UtcDateTimeConverter());
    // العربية في الردود كما هي بدل \uXXXX (ردود JSON لا تُضمَّن في HTML)
    o.JsonSerializerOptions.Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping;
});

// أخطاء التحقق من المدخلات بنفس شكل ApiResponse بدل ValidationProblemDetails
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    // NotFound()/Forbid() بلا نص و415 عند جسم فارغ كانت تخرج ProblemDetails — تتولاها UseStatusCodePages بشكل ApiResponse
    options.SuppressMapClientErrors = true;
    options.InvalidModelStateResponseFactory = context =>
    {
        // رسائل الإطار الافتراضية بالإنجليزية ← عربية مفهومة تسمّي الحقل (رسائلنا العربية تبقى كما هي)
        static string FieldName(string key)
        {
            var last = key.Split('.', '[').Last().Trim(']', '$');
            var names = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["customerNotes"] = "ملاحظات الطلب", ["notes"] = "الملاحظات", ["addressId"] = "العنوان",
                ["streetAddress"] = "الشارع", ["area"] = "المنطقة", ["city"] = "المدينة",
                ["buildingNumber"] = "رقم البناية", ["floorNumber"] = "رقم الطابق", ["apartmentNumber"] = "رقم الشقة",
                ["fullName"] = "الاسم", ["email"] = "البريد الإلكتروني", ["phone"] = "رقم الهاتف", ["password"] = "كلمة المرور",
                ["reason"] = "السبب", ["quantity"] = "الكمية", ["productId"] = "المنتج",
                ["code"] = "رمز الكوبون", ["couponCode"] = "رمز الكوبون", ["label"] = "اسم العنوان",
                ["name"] = "الاسم", ["nameAr"] = "الاسم بالعربية", ["description"] = "الوصف", ["descriptionAr"] = "الوصف بالعربية",
                ["title"] = "العنوان", ["comment"] = "التعليق", ["details"] = "التفاصيل", ["amount"] = "المبلغ",
                ["reference"] = "رقم المرجع", ["price"] = "السعر", ["discountValue"] = "قيمة الخصم",
                ["cancellationReason"] = "سبب الإلغاء", ["refusalReason"] = "سبب الرفض", ["rating"] = "التقييم",
                ["latitude"] = "موقع الخريطة", ["longitude"] = "موقع الخريطة", ["variantId"] = "الخيار",
                ["deliverySlotStart"] = "موعد التوصيل", ["identifier"] = "رقم الهاتف أو البريد",
            };
            // حقل لم نسمّه بعد: «أحد الحقول» بدل اسمه البرمجي بالإنجليزية
            return names.TryGetValue(last, out var ar) ? ar : "أحد الحقول";
        }
        static string Arabic(string key, string m) =>
            System.Text.RegularExpressions.Regex.IsMatch(m, "[؀-ۿ]") ? m
            : m.Contains("is required") ? (string.IsNullOrEmpty(key) || key == "dto" || FieldName(key) == "أحد الحقول" ? "يرجى تعبئة كل الحقول المطلوبة" : $"الحقل «{FieldName(key)}» مطلوب")
            : m.Contains("not a valid e-mail") || m.Contains("valid email") ? "البريد الإلكتروني غير صحيح"
            : m.Contains("maximum length") || m.Contains("minimum length") ? Field("طول", key, "غير مسموح")
            : string.IsNullOrEmpty(key) ? "بيانات غير صالحة — تحقق من الحقول وأعد المحاولة" : Field("قيمة", key, "غير صالحة");
        static string Field(string what, string key, string tail) =>
            FieldName(key) is "أحد الحقول" ? $"{what} أحد الحقول {tail}" : $"{what} الحقل «{FieldName(key)}» {tail}";

        var message = string.Join(" | ", context.ModelState
            .SelectMany(kv => kv.Value!.Errors.Select(e => Arabic(kv.Key,
                string.IsNullOrEmpty(e.ErrorMessage) ? e.Exception?.Message ?? "" : e.ErrorMessage)))
            .Distinct());

        return new BadRequestObjectResult(
            ApiResponse<object>.Fail(message, context.HttpContext.TraceIdentifier));
    };
});
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    // إضافة دعم JWT في Swagger
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "أدخل الـ JWT Token بهذا الشكل: Bearer {token}"
    });

    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
    c.OperationFilter<FileUploadOperationFilter>();
});

// JWT Settings
// ===================================
builder.Services.Configure<JwtSettings>(
    builder.Configuration.GetSection("JwtSettings"));

var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>();
if (string.IsNullOrWhiteSpace(jwtSettings?.Secret) || jwtSettings.Secret.Length < 32)
{
    throw new InvalidOperationException(
        "JwtSettings:Secret غير مُعرَّف أو قصير جدًا. في بيئة التطوير: dotnet user-secrets set \"JwtSettings:Secret\" \"<قيمة عشوائية 32+ حرفًا>\". " +
        "في الإنتاج: عيّن متغيّر البيئة JwtSettings__Secret.");
}
var key = Encoding.ASCII.GetBytes(jwtSettings.Secret);

// Authentication
// ===================================
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    // يُشترط HTTPS تلقائيًا في أي بيئة غير Development — لا حاجة لتعديل يدوي قبل النشر
    options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidateAudience = true,
        ValidAudience = jwtSettings.Audience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };

    // SignalR لا يستطيع إرسال Authorization header عبر WebSocket،
    // فيرسل التوكن كـ access_token في الـ query string بدلاً من ذلك
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;

            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        },

        // التوقيع وحده لا يكفي: الحساب يجب أن يكون مفعّلاً ونسخة الجلسة هي الحالية
        // (تعطيل الحساب أو تغيير دوره أو كلمة مروره يُبطل التوكنات فوراً)
        OnTokenValidated = async context =>
        {
            var principal = context.Principal!;
            var valid = Guid.TryParse(principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var userId)
                && int.TryParse(principal.FindFirst(UserSessionValidator.VersionClaim)?.Value, out var version)
                && await context.HttpContext.RequestServices.GetRequiredService<IUserSessionValidator>()
                    .IsCurrentAsync(userId, version, context.HttpContext.RequestAborted);
            if (!valid)
                context.Fail("Session revoked");
        }
    };
});

// Authorization
// ===================================
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(PolicyNames.CustomerOnly, policy =>
        policy.RequireRole("CUSTOMER"));

    options.AddPolicy(PolicyNames.OpsOnly, policy =>
        policy.RequireRole("OPS"));

    options.AddPolicy(PolicyNames.AdminOnly, policy =>
        policy.RequireRole("ADMIN"));

    options.AddPolicy(PolicyNames.OpsOrAdmin, policy =>
        policy.RequireRole("OPS", "ADMIN"));
    options.AddPolicy(PolicyNames.OpsOrAdminOrVendor, policy =>
        policy.RequireRole("OPS", "ADMIN", "VENDOR"));
    options.AddPolicy(PolicyNames.VendorOnly, policy =>
    policy.RequireRole("VENDOR"));
    options.AddPolicy(PolicyNames.DriverOnly, policy =>
        policy.RequireRole("DRIVER"));
});


builder.Services.AddSignalR();

// ===================================
// حدود الطلبات لكل عنوان: إنشاء الحسابات وطلب رموز الاستعادة
// (حدود كل رقم هاتف في AuthThrottle). العنوان الحقيقي من X-Forwarded-For عبر الوكيل المحلي.
// ===================================
builder.Services.Configure<Microsoft.AspNetCore.Builder.ForwardedHeadersOptions>(o =>
    o.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.ContentType = "application/json; charset=utf-8";
        await ctx.HttpContext.Response.WriteAsync(
            "{\"success\":false,\"message\":\"طلبات كثيرة من هذا الجهاز — حاول بعد قليل\"}", ct);
    };
    options.AddPolicy("auth-ip", http => System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
        {
            PermitLimit = 20,
            Window = TimeSpan.FromMinutes(10),
            QueueLimit = 0,
        }));
    // تسجيل الدخول: تجربة كلمة مرور على حسابات كثيرة يمنعها عدّ المحاولات الخاطئة لكل عنوان (AuthThrottle) —
    // هذا الحد للإغراق فقط، واسع لأن مشتركي شبكة موبايل واحدة يتشاركون عنواناً ويدخلون بنجاح
    options.AddPolicy("login-ip", http => System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
        {
            PermitLimit = 150,
            Window = TimeSpan.FromMinutes(5),
            QueueLimit = 0,
        }));
    // تحديث محتوى حسابات التواصل (طلب عام يتصل بتيك توك وإنستغرام): يكفي لفتح المتاجر والريلز بشكل طبيعي
    options.AddPolicy("social-refresh", http => System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
        {
            PermitLimit = 30,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
});

// ===================================
// إضافة CORS (مهم للـ SignalR)
// ===================================
// النطاقات المسموحة من الإعدادات (Cors:AllowedOrigins) — في الإنتاج: Cors__AllowedOrigins__0=https://...
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
if (allowedOrigins.Length == 0)
    throw new InvalidOperationException("Cors:AllowedOrigins is empty — set the frontend origin(s) in configuration.");

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});



builder.Services.AddAppPersistence(builder.Configuration);
builder.Services.AddAppServices();
builder.Services.AddAppDataProtection(builder.Configuration, builder.Environment);
builder.Services.AddTikTokIntegration(builder.Configuration);
builder.Services.AddInstagramIntegration(builder.Configuration);
builder.Services.AddFacebookIntegration(builder.Configuration);

//builder.WebHost.UseUrls("http://0.0.0.0:5000");

var wwwrootPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
if (!Directory.Exists(wwwrootPath))
    Directory.CreateDirectory(wwwrootPath);

var uploadsPath = Path.Combine(wwwrootPath, "uploads");
if (!Directory.Exists(uploadsPath))
    Directory.CreateDirectory(uploadsPath);

var app = builder.Build();
// إضافة SignalR
// ===================================
//app.MapGet("/debug/ops-signalr", async (IHubContext<OpsHub> hub) =>
//{
//    await hub.Clients.Group("OpsTeam").SendAsync("NewSubOrder", new
//    {
//        subOrderNumber = "DEBUG-123",
//        message = "رسالة اختبار من السيرفر",
//        timestamp = DateTime.UtcNow
//    });

//    return Results.Ok("Message sent to OpsTeam");
//});


// Configure the HTTP request pipeline.

app.UseForwardedHeaders();
app.UseAppExceptionHandling();

// ردود بلا نص (رفض الصلاحية 403، عدم تسجيل الدخول 401، مسار غير موجود): رسالة عربية بنفس شكل باقي الردود
var StatusPageJson = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)
{
    Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
};
app.UseStatusCodePages(async ctx =>
{
    var http = ctx.HttpContext;
    if (!http.Request.Path.StartsWithSegments("/api")) return;
    var message = http.Response.StatusCode switch
    {
        StatusCodes.Status401Unauthorized => "سجّل الدخول أولاً — انتهت الجلسة أو لم تسجّل الدخول",
        StatusCodes.Status403Forbidden => "ليس لديك صلاحية لهذا الإجراء",
        StatusCodes.Status404NotFound => "غير موجود",
        StatusCodes.Status405MethodNotAllowed => "طريقة الطلب غير مدعومة",
        StatusCodes.Status415UnsupportedMediaType => "أرسل البيانات بصيغة JSON",
        _ => "تعذّر تنفيذ الطلب",
    };
    // نفس شكل ApiResponse.Fail (مع traceId)، والعربية كما هي لا \uXXXX
    http.Response.ContentType = "application/json; charset=utf-8";
    await http.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(
        ApiResponse<object>.Fail(message, http.TraceIdentifier), StatusPageJson));
});

app.UseImageVariants();
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHsts();
}

app.UseCors("Frontend");
app.UseWebSockets();

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

// GET /health — يُستخدم للمراقبة: Healthy / Unhealthy مع حالة قاعدة البيانات
app.MapHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    ResponseWriter = async (ctx, report) =>
    {
        ctx.Response.ContentType = "application/json; charset=utf-8";
        await ctx.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            checks = report.Entries.ToDictionary(e => e.Key, e => e.Value.Status.ToString()),
            time = DateTime.UtcNow,
        }));
    }
}).AllowAnonymous();

app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHub<OpsHub>("/hubs/ops");
app.Run();

