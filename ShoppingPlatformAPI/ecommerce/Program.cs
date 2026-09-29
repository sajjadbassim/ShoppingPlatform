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

// Add services to the container.

builder.Services.AddControllers(options =>
{
    var policy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();

    options.Filters.Add(new AuthorizeFilter(policy));
});

// أخطاء التحقق من المدخلات بنفس شكل ApiResponse بدل ValidationProblemDetails
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var message = string.Join(" | ", context.ModelState.Values
            .SelectMany(v => v.Errors)
            .Select(e => e.ErrorMessage));

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
});


builder.Services.AddSignalR();

// ===================================
// إضافة CORS (مهم للـ SignalR)
// ===================================
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:4200", "http://localhost:5173") // Frontend URLs
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});



builder.Services.AddAppPersistence(builder.Configuration);
builder.Services.AddAppServices();

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

app.UseAppExceptionHandling();

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

app.UseCors("AllowAll");
app.UseWebSockets();

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHub<OpsHub>("/hubs/ops");
app.Run();

