using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace ecommerce.Tests.Services
{
    public class AvatarServiceTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly string _root = Path.Combine(Path.GetTempPath(), "avatar-tests-" + Guid.NewGuid().ToString("N"));

        internal static readonly byte[] Png = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3 };
        internal static readonly byte[] Jpg = { 0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3 };

        // صور Google وهمية: الرابط → المحتوى (null = فشل الجلب)
        internal class FakeFetcher : IGooglePictureFetcher
        {
            public readonly Dictionary<string, byte[]?> Pictures = new();
            public int Calls;
            public Task<byte[]?> FetchAsync(string url)
            {
                Calls++;
                if (url.Contains("throw")) throw new HttpRequestException("down");
                return Task.FromResult(Pictures.TryGetValue(url, out var b) ? b : null);
            }
        }

        private readonly FakeFetcher _fetcher = new();

        public void Dispose()
        {
            _context.Dispose();
            if (Directory.Exists(_root)) Directory.Delete(_root, true);
        }

        private AvatarService Service()
        {
            var env = new Mock<IWebHostEnvironment>();
            env.Setup(e => e.WebRootPath).Returns(_root);
            return new AvatarService(_context, env.Object, _fetcher, NullLogger<AvatarService>.Instance);
        }

        private User AddUser()
        {
            var u = new User { Phone = "07701234567", FullName = "مستخدم", Email = "", Role = UserRoles.Customer, PasswordHash = "x", IsActive = true };
            _context.Users.Add(u); _context.SaveChanges();
            return u;
        }

        private static IFormFile File(byte[] bytes, string name = "a.png")
            => new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", name);

        private string Disk(string url) => Path.Combine(_root, url.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

        [Fact]
        public async Task Upload_SavesFile_AndReplacingDeletesTheOldOne()
        {
            var u = AddUser();
            var first = await Service().UploadAsync(u.Id, File(Png));
            Assert.StartsWith("/uploads/avatars/", first);
            Assert.EndsWith(".png", first);
            Assert.True(System.IO.File.Exists(Disk(first)));

            var second = await Service().UploadAsync(u.Id, File(Jpg, "b.png"));   // النوع من المحتوى لا من الاسم
            Assert.EndsWith(".jpg", second);
            Assert.False(System.IO.File.Exists(Disk(first)));
            Assert.Equal(AvatarSources.Upload, (await _context.Users.FindAsync(u.Id))!.AvatarSource);
        }

        [Fact]
        public async Task Upload_RejectsNonImageContent()
        {
            var u = AddUser();
            var html = System.Text.Encoding.UTF8.GetBytes("<html><script>alert(1)</script>");
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().UploadAsync(u.Id, File(html, "x.png")));
            Assert.Null((await _context.Users.FindAsync(u.Id))!.AvatarUrl);
        }

        [Fact]
        public async Task Remove_ClearsPhoto_AndGoogleNoLongerRestoresIt()
        {
            var u = AddUser();
            var url = await Service().UploadAsync(u.Id, File(Png));
            await Service().RemoveAsync(u.Id);
            Assert.Null(u.AvatarUrl);
            Assert.False(System.IO.File.Exists(Disk(url)));

            _fetcher.Pictures["https://lh3.googleusercontent.com/a/p1=s256-c"] = Png;
            await Service().SyncGoogleAsync(u, "https://lh3.googleusercontent.com/a/p1=s96-c");
            Assert.Null(u.AvatarUrl);
        }

        [Fact]
        public async Task GooglePicture_IsCopied_UpdatedWhenChanged_ButNeverOverridesAnUpload()
        {
            var u = AddUser();
            _fetcher.Pictures["https://lh3.googleusercontent.com/a/p1=s256-c"] = Png;
            _fetcher.Pictures["https://lh3.googleusercontent.com/a/p2=s256-c"] = Jpg;

            await Service().SyncGoogleAsync(u, "https://lh3.googleusercontent.com/a/p1=s96-c");
            var first = u.AvatarUrl!;
            Assert.Equal(AvatarSources.Google, u.AvatarSource);
            Assert.True(System.IO.File.Exists(Disk(first)));

            // نفس الصورة: لا جلب جديد
            await Service().SyncGoogleAsync(u, "https://lh3.googleusercontent.com/a/p1=s96-c");
            Assert.Equal(1, _fetcher.Calls);

            // تغيّرت في Google: تُستبدل
            await Service().SyncGoogleAsync(u, "https://lh3.googleusercontent.com/a/p2=s96-c");
            Assert.EndsWith(".jpg", u.AvatarUrl);
            Assert.False(System.IO.File.Exists(Disk(first)));
            await _context.SaveChangesAsync();

            // صورة رفعها بنفسه لا تُستبدل
            var uploaded = await Service().UploadAsync(u.Id, File(Png));
            await Service().SyncGoogleAsync(u, "https://lh3.googleusercontent.com/a/p1=s96-c");
            Assert.Equal(uploaded, u.AvatarUrl);
        }

        [Fact]
        public async Task GoogleFetchFailure_DoesNotThrow()
        {
            var u = AddUser();
            await Service().SyncGoogleAsync(u, "https://lh3.googleusercontent.com/a/throw=s96-c");
            await Service().SyncGoogleAsync(u, "https://lh3.googleusercontent.com/a/missing=s96-c");
            Assert.Null(u.AvatarUrl);
        }
    }
}
