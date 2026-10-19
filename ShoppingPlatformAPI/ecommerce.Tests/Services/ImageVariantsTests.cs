using ecommerce.Middleware;
using ecommerce.Services.FileService;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using SkiaSharp;

namespace ecommerce.Tests.Services
{
    // تصغير الصور عند الطلب: /uploads/...?w=600 → نسخة WebP محفوظة على القرص
    public class ImageVariantsTests : IDisposable
    {
        private readonly string _root = Path.Combine(Path.GetTempPath(), "variants-tests-" + Guid.NewGuid().ToString("N"));

        public void Dispose()
        {
            if (Directory.Exists(_root)) Directory.Delete(_root, true);
        }

        private IWebHostEnvironment Env()
        {
            var env = new Mock<IWebHostEnvironment>();
            env.Setup(e => e.WebRootPath).Returns(_root);
            return env.Object;
        }

        private string SavePng(string relativeUrl, int width, int height)
        {
            var path = Path.Combine(_root, relativeUrl.TrimStart('/'));
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            using var bitmap = new SKBitmap(width, height);
            bitmap.Erase(SKColors.Red);
            using var data = bitmap.Encode(SKEncodedImageFormat.Png, 100);
            File.WriteAllBytes(path, data.ToArray());
            return path;
        }

        private SKSizeI SizeOf(string relativeUrl)
        {
            using var codec = SKCodec.Create(Path.Combine(_root, relativeUrl.TrimStart('/')));
            Assert.Equal(SKEncodedImageFormat.Webp, codec.EncodedFormat);
            return new SKSizeI(codec.Info.Width, codec.Info.Height);
        }

        [Fact]
        public async Task Resizes_ToRequestedWidth_KeepingAspect_AsWebp()
        {
            SavePng("/uploads/products/a.png", 2000, 1000);
            var url = await new ImageVariants(Env()).EnsureAsync("/uploads/products/a.png", 600);

            Assert.Equal("/uploads/_w/600/products/a.png.webp", url);
            Assert.Equal(new SKSizeI(600, 300), SizeOf(url!));
        }

        [Fact]
        public void UnknownWidth_SnapsToNextAllowed_CappedAtLargest()
        {
            Assert.Equal(200, ImageVariants.SnapWidth(50));
            Assert.Equal(600, ImageVariants.SnapWidth(201));
            Assert.Equal(1200, ImageVariants.SnapWidth(5000));
        }

        [Fact]
        public async Task SmallImage_IsNotUpscaled()
        {
            SavePng("/uploads/products/small.png", 100, 80);
            var url = await new ImageVariants(Env()).EnsureAsync("/uploads/products/small.png", 1200);
            Assert.Equal(new SKSizeI(100, 80), SizeOf(url!));
        }

        [Theory]
        [InlineData("/uploads/products/missing.png")]
        [InlineData("/uploads/../secret.png")]
        [InlineData("/other/a.png")]
        [InlineData("/uploads/products/anim.gif")]
        [InlineData("/uploads/_w/600/products/a.png.webp")]
        public async Task Missing_Outside_Gif_OrVariant_ServesOriginal(string url)
        {
            SavePng("/secret.png", 50, 50);
            SavePng("/uploads/products/anim.gif", 50, 50);
            SavePng("/uploads/_w/600/products/a.png.webp", 50, 50);
            Assert.Null(await new ImageVariants(Env()).EnsureAsync(url, 600));
        }

        [Fact]
        public async Task DeletingImage_RemovesItsVariants()
        {
            var source = SavePng("/uploads/products/d.png", 1500, 1500);
            var variants = new ImageVariants(Env());
            var small = await variants.EnsureAsync("/uploads/products/d.png", 200);
            var large = await variants.EnsureAsync("/uploads/products/d.png", 1200);

            await new FileService(Env()).DeleteImageAsync("/uploads/products/d.png");

            Assert.False(File.Exists(source));
            Assert.False(File.Exists(Path.Combine(_root, small!.TrimStart('/'))));
            Assert.False(File.Exists(Path.Combine(_root, large!.TrimStart('/'))));
        }

        [Fact]
        public async Task Middleware_RewritesPath_OnlyWhenWidthGiven()
        {
            SavePng("/uploads/products/m.png", 800, 400);
            var middleware = new ImageVariantMiddleware(_ => Task.CompletedTask, new ImageVariants(Env()),
                NullLogger<ImageVariantMiddleware>.Instance);

            var withWidth = new DefaultHttpContext();
            withWidth.Request.Method = "GET";
            withWidth.Request.Path = "/uploads/products/m.png";
            withWidth.Request.QueryString = new QueryString("?w=600");
            await middleware.InvokeAsync(withWidth);
            Assert.Equal("/uploads/_w/600/products/m.png.webp", withWidth.Request.Path.Value);

            var original = new DefaultHttpContext();
            original.Request.Method = "GET";
            original.Request.Path = "/uploads/products/m.png";
            await middleware.InvokeAsync(original);
            Assert.Equal("/uploads/products/m.png", original.Request.Path.Value);
        }
    }
}
