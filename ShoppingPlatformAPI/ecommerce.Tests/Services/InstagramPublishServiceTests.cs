using ecommerce.Core.DTO.Instagram;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.InstagramService;
using ecommerce.Services.SocialPublishService;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using SkiaSharp;

namespace ecommerce.Tests.Services
{
    // النشر على إنستغرام: صورة وألبوم، الحد اليومي، انتهاء الربط، عدم النشر مرتين، والتحقق من المدخلات
    public class InstagramPublishServiceTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly Mock<IInstagramService> _instagram = new();
        private readonly Mock<IInstagramApiClient> _api = new();
        private readonly Mock<IInstagramImagePreparer> _images = new();
        private readonly Mock<ISocialMediaStore> _uploads = new();
        private readonly FakeTime _time = new(new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero));
        private readonly InstagramOptions _options = new()
        {
            AppId = "app", AppSecret = "secret", RedirectUri = "https://example.com/cb", PublicBaseUrl = "https://shop.example.com",
            PublishPollIntervalSeconds = 0
        };
        private readonly Guid _ownerId = Guid.NewGuid();
        private readonly Vendor _store;
        private readonly Product _product;

        public InstagramPublishServiceTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

            _store = new Vendor { Name = "Store", NameAr = "متجر الورد", OwnerId = _ownerId };
            var category = new Category { Name = "Perfume", NameAr = "عطور نسائية", Description = "-", IconUrl = "" };
            _product = new Product
            {
                VendorId = _store.Id, CategoryId = category.Id, Name = "Rose", NameAr = "عطر الورد",
                Description = "عطر فرنسي", Price = 25000, StockQuantity = 5
            };
            _context.AddRange(_store, category, _product,
                new ProductImage { ProductId = _product.Id, ImageUrl = "/uploads/products/b.png", DisplayOrder = 1 },
                new ProductImage { ProductId = _product.Id, ImageUrl = "/uploads/products/a.png", IsPrimary = true, DisplayOrder = 0 },
                new InstagramConnection { VendorId = _store.Id, InstagramUserId = "ig1", Username = "rose_store" });
            _context.SaveChanges();

            _instagram.Setup(i => i.GetPublishSessionAsync(_store.Id, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new InstagramPublishSession("ig1", "token", "rose_store", true));
            _images.Setup(i => i.PrepareAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((string src, CancellationToken _) => "/uploads/social/ig-" + Path.GetFileNameWithoutExtension(src) + ".jpg");
            _api.Setup(a => a.GetPublishingLimitAsync("token", "ig1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new InstagramPublishingLimit { QuotaUsage = 3, Config = new InstagramPublishingLimitConfig { QuotaTotal = 100 } });
            _api.Setup(a => a.GetContainerStatusAsync("token", It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync("FINISHED");
            _api.Setup(a => a.PublishContainerAsync("token", "ig1", It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync("media1");
            _api.Setup(a => a.GetPermalinkAsync("token", "media1", It.IsAny<CancellationToken>())).ReturnsAsync("https://instagram.com/p/x");
        }

        public void Dispose() => _context.Dispose();

        private InstagramPublishService Service() => new(_context, _instagram.Object, _api.Object, _images.Object, _uploads.Object,
            Options.Create(_options), _time, NullLogger<InstagramPublishService>.Instance);

        private CreateInstagramPostDto Request(params string[] images) => new()
        {
            ProductId = _product.Id,
            Images = images.Length > 0 ? images.ToList() : new List<string> { "/uploads/products/a.png" },
            Caption = "عطر الورد #عطور"
        };

        private InstagramPost StoredPost(Guid id)
        {
            _context.ChangeTracker.Clear();
            return _context.Set<InstagramPost>().Single(p => p.Id == id);
        }

        // ===================================
        // النشر
        // ===================================
        [Fact]
        public async Task PublishNow_SingleImage_PublishesAndLinksToProduct()
        {
            _api.Setup(a => a.CreateImageContainerAsync("token", "ig1", "https://shop.example.com/uploads/social/ig-a.jpg",
                "عطر الورد #عطور", false, It.IsAny<CancellationToken>())).ReturnsAsync("c1");

            var result = await Service().CreateAsync(_ownerId, Request());

            Assert.Equal(InstagramPost.StatusPublished, result.Status);
            Assert.Equal("https://instagram.com/p/x", result.Permalink);
            _api.Verify(a => a.PublishContainerAsync("token", "ig1", "c1", It.IsAny<CancellationToken>()), Times.Once);
            _instagram.Verify(i => i.RecordPublishedMediaAsync(_store.Id, "media1", _product.Id, "عطر الورد #عطور",
                "/uploads/products/a.png", InstagramMedia.TypeImage, It.IsAny<CancellationToken>()), Times.Once);
            _images.Verify(i => i.Delete(It.Is<IEnumerable<string>>(l => l.Single() == "/uploads/social/ig-a.jpg")), Times.Once);
            Assert.Null(StoredPost(result.Id).PreparedImagesJson);
        }

        [Fact]
        public async Task PublishNow_SeveralImages_CreatesCarouselInChosenOrder()
        {
            _api.SetupSequence(a => a.CreateImageContainerAsync("token", "ig1", It.IsAny<string>(), null, true, It.IsAny<CancellationToken>()))
                .ReturnsAsync("child-b").ReturnsAsync("child-a");
            _api.Setup(a => a.CreateCarouselContainerAsync("token", "ig1", It.IsAny<IReadOnlyList<string>>(), "عطر الورد #عطور", It.IsAny<CancellationToken>()))
                .ReturnsAsync("album");

            var result = await Service().CreateAsync(_ownerId, Request("/uploads/products/b.png", "/uploads/products/a.png"));

            Assert.Equal(InstagramPost.StatusPublished, result.Status);
            _api.Verify(a => a.CreateCarouselContainerAsync("token", "ig1",
                It.Is<IReadOnlyList<string>>(c => c.SequenceEqual(new[] { "child-b", "child-a" })), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
            _api.Verify(a => a.PublishContainerAsync("token", "ig1", "album", It.IsAny<CancellationToken>()), Times.Once);
            _instagram.Verify(i => i.RecordPublishedMediaAsync(_store.Id, "media1", _product.Id, It.IsAny<string>(),
                "/uploads/products/b.png", InstagramMedia.TypeCarousel, It.IsAny<CancellationToken>()), Times.Once);
        }

        // ===================================
        // من الاستوديو: صور وفيديو رفعها التاجر
        // ===================================
        private const string Clip = "/uploads/social/v-store/clip.mp4";
        private const string Photo = "/uploads/social/v-store/photo.jpg";

        [Fact]
        public async Task SingleUploadedVideo_PublishesAsReelWithoutImagePreparation()
        {
            _uploads.Setup(u => u.IsVendorUpload(_store.Id, Clip)).Returns(true);
            _api.Setup(a => a.CreateVideoContainerAsync("token", "ig1", "https://shop.example.com" + Clip, "عطر الورد #عطور", false, It.IsAny<CancellationToken>()))
                .ReturnsAsync("reel");

            var result = await Service().CreateAsync(_ownerId, Request(Clip));

            Assert.Equal(InstagramPost.StatusPublished, result.Status);
            _api.Verify(a => a.PublishContainerAsync("token", "ig1", "reel", It.IsAny<CancellationToken>()), Times.Once);
            _images.Verify(i => i.PrepareAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _instagram.Verify(i => i.RecordPublishedMediaAsync(_store.Id, "media1", _product.Id, It.IsAny<string>(),
                Clip, InstagramMedia.TypeVideo, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task CarouselWithUploadedPhotoAndVideo_CreatesMatchingChildren()
        {
            _uploads.Setup(u => u.IsVendorUpload(_store.Id, It.IsIn(Clip, Photo))).Returns(true);
            _api.Setup(a => a.CreateImageContainerAsync("token", "ig1", "https://shop.example.com/uploads/social/ig-photo.jpg", null, true, It.IsAny<CancellationToken>()))
                .ReturnsAsync("child-photo");
            _api.Setup(a => a.CreateVideoContainerAsync("token", "ig1", "https://shop.example.com" + Clip, null, true, It.IsAny<CancellationToken>()))
                .ReturnsAsync("child-video");
            _api.Setup(a => a.CreateCarouselContainerAsync("token", "ig1", It.IsAny<IReadOnlyList<string>>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("album");

            var result = await Service().CreateAsync(_ownerId, Request(Photo, Clip));

            Assert.Equal(InstagramPost.StatusPublished, result.Status);
            _api.Verify(a => a.CreateCarouselContainerAsync("token", "ig1",
                It.Is<IReadOnlyList<string>>(c => c.SequenceEqual(new[] { "child-photo", "child-video" })), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
            // المجهِّز يحذف صورته المجهزة فقط — الفيديو المرفوع يبقى لسجل المنشورات
            _images.Verify(i => i.Delete(It.Is<IEnumerable<string>>(l => l.Contains("/uploads/social/ig-photo.jpg"))), Times.Once);
        }

        [Fact]
        public async Task VideoStillProcessing_ReschedulesThenFailsAfterTooManyChecks()
        {
            _uploads.Setup(u => u.IsVendorUpload(_store.Id, Clip)).Returns(true);
            _api.Setup(a => a.CreateVideoContainerAsync("token", "ig1", It.IsAny<string>(), It.IsAny<string>(), false, It.IsAny<CancellationToken>())).ReturnsAsync("reel");
            _api.Setup(a => a.GetContainerStatusAsync("token", "reel", It.IsAny<CancellationToken>())).ReturnsAsync("IN_PROGRESS");
            var dto = Request(Clip);
            dto.ScheduledAt = _time.GetUtcNow().UtcDateTime.AddMinutes(5);
            var post = await Service().CreateAsync(_ownerId, dto);
            _context.ChangeTracker.Clear();
            var stored = _context.Set<InstagramPost>().Single();
            stored.Attempts = 9;   // تخطّي الانتظار الطويل: المحاولة القادمة هي العاشرة
            await _context.SaveChangesAsync();

            _time.Advance(TimeSpan.FromMinutes(10));
            await Service().ProcessDueAsync();

            var final = StoredPost(post.Id);
            Assert.Equal(InstagramPost.StatusFailed, final.Status);
            Assert.Contains("وقتاً طويلاً", final.Error);
            _api.Verify(a => a.PublishContainerAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Schedule_InFuture_WaitsForBackgroundRun()
        {
            var dto = Request();
            dto.ScheduledAt = _time.GetUtcNow().UtcDateTime.AddHours(2);

            var result = await Service().CreateAsync(_ownerId, dto);

            Assert.Equal(InstagramPost.StatusScheduled, result.Status);
            _api.Verify(a => a.PublishContainerAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);

            Assert.Equal(0, await Service().ProcessDueAsync());   // لم يحن الموعد

            _api.Setup(a => a.CreateImageContainerAsync("token", "ig1", It.IsAny<string>(), It.IsAny<string>(), false, It.IsAny<CancellationToken>()))
                .ReturnsAsync("c1");
            _time.Advance(TimeSpan.FromHours(2));
            Assert.Equal(1, await Service().ProcessDueAsync());
            Assert.Equal(InstagramPost.StatusPublished, StoredPost(result.Id).Status);
        }

        [Fact]
        public async Task DailyLimitReached_ReschedulesWithoutPublishing()
        {
            _api.Setup(a => a.GetPublishingLimitAsync("token", "ig1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new InstagramPublishingLimit { QuotaUsage = 100, Config = new InstagramPublishingLimitConfig { QuotaTotal = 100 } });

            var result = await Service().CreateAsync(_ownerId, Request());

            Assert.Equal(InstagramPost.StatusScheduled, result.Status);
            Assert.Contains("حد النشر اليومي", result.Error);
            Assert.Equal(_time.GetUtcNow().UtcDateTime.AddHours(1), StoredPost(result.Id).NextAttemptAt);
            _api.Verify(a => a.CreateImageContainerAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task ExpiredConnection_FailsWithReconnectMessage()
        {
            _api.Setup(a => a.CreateImageContainerAsync("token", "ig1", It.IsAny<string>(), It.IsAny<string>(), false, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InstagramApiException("expired", "190", requiresReconnect: true));

            var result = await Service().CreateAsync(_ownerId, Request());

            Assert.Equal(InstagramPost.StatusFailed, result.Status);
            Assert.Contains("أعد ربط", result.Error);
        }

        [Fact]
        public async Task TransientError_RetriesThenFailsAfterMaxAttempts()
        {
            _api.Setup(a => a.CreateImageContainerAsync("token", "ig1", It.IsAny<string>(), It.IsAny<string>(), false, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InstagramApiException("busy", "2"));

            var result = await Service().CreateAsync(_ownerId, Request());
            Assert.Equal(InstagramPost.StatusScheduled, result.Status);

            for (var i = 0; i < 2; i++)
            {
                _time.Advance(TimeSpan.FromMinutes(10));
                await Service().ProcessDueAsync();
            }

            var post = StoredPost(result.Id);
            Assert.Equal(InstagramPost.StatusFailed, post.Status);
            Assert.Equal(3, post.Attempts);
        }

        [Fact]
        public async Task ContainerAlreadyPublished_IsNotPublishedAgain()
        {
            var post = new InstagramPost
            {
                VendorId = _store.Id, ProductId = _product.Id, CreatedByUserId = _ownerId, Caption = "x",
                SourceImagesJson = "[\"/uploads/products/a.png\"]", PreparedImagesJson = "[\"/uploads/social/ig-a.jpg\"]",
                Status = InstagramPost.StatusScheduled, ScheduledAt = _time.GetUtcNow().UtcDateTime, ContainerId = "c-old"
            };
            _context.Add(post);
            await _context.SaveChangesAsync();
            _api.Setup(a => a.GetContainerStatusAsync("token", "c-old", It.IsAny<CancellationToken>())).ReturnsAsync("PUBLISHED");

            await Service().ProcessDueAsync();

            Assert.Equal(InstagramPost.StatusPublished, StoredPost(post.Id).Status);
            _api.Verify(a => a.PublishContainerAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _images.Verify(i => i.Delete(It.IsAny<IEnumerable<string>>()), Times.Once);
        }

        [Fact]
        public async Task PublishingPermissionMissing_IsRejectedBeforeSaving()
        {
            _instagram.Setup(i => i.GetPublishSessionAsync(_store.Id, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new InstagramPublishSession("ig1", "token", "rose_store", false));

            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().CreateAsync(_ownerId, Request()));
            Assert.Empty(_context.Set<InstagramPost>());
        }

        [Fact]
        public async Task Disconnect_RemovesPostHistoryAndScheduledPosts()
        {
            var dto = Request();
            dto.ScheduledAt = _time.GetUtcNow().UtcDateTime.AddHours(1);
            await Service().CreateAsync(_ownerId, dto);
            var connection = _context.Set<InstagramConnection>().Single();

            new ecommerce.Repositories.InstagramRepository(_context).RemoveConnection(connection);
            await _context.SaveChangesAsync();

            Assert.Empty(_context.Set<InstagramPost>());
        }

        // ===================================
        // التحقق من المدخلات
        // ===================================
        [Fact]
        public async Task ImageFromAnotherProduct_IsRejected()
        {
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().CreateAsync(_ownerId, Request("/uploads/products/other.png")));
        }

        [Fact]
        public async Task ProductOfAnotherStore_IsNotFound()
        {
            var other = new Vendor { Name = "o", NameAr = "o", OwnerId = Guid.NewGuid() };
            _context.Add(other);
            await _context.SaveChangesAsync();

            await Assert.ThrowsAsync<NotFoundException>(() => Service().CreateAsync(other.OwnerId!.Value, Request()));
        }

        [Theory]
        [InlineData(-10)]      // في الماضي
        [InlineData(60 * 24 * 31)]   // أبعد من 30 يوماً
        public async Task ScheduleOutsideWindow_IsRejected(int minutes)
        {
            var dto = Request();
            dto.ScheduledAt = _time.GetUtcNow().UtcDateTime.AddMinutes(minutes);
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().CreateAsync(_ownerId, dto));
        }

        [Fact]
        public async Task PublishingDisabled_WhenPublicUrlMissing()
        {
            _options.PublicBaseUrl = "";
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().CreateAsync(_ownerId, Request()));
        }

        [Fact]
        public void Caption_Limits()
        {
            InstagramPublishService.ValidateCaption("نص #وسم");
            Assert.Throws<BusinessRuleException>(() => InstagramPublishService.ValidateCaption(""));
            Assert.Throws<BusinessRuleException>(() => InstagramPublishService.ValidateCaption(new string('x', 2201)));
            Assert.Throws<BusinessRuleException>(() => InstagramPublishService.ValidateCaption(
                string.Join(' ', Enumerable.Range(0, 31).Select(i => $"#tag{i}"))));
            Assert.Throws<BusinessRuleException>(() => InstagramPublishService.ValidateCaption(
                string.Join(' ', Enumerable.Range(0, 21).Select(i => $"@user{i}"))));
        }

        [Fact]
        public async Task Options_SuggestCaptionAndOrderImages()
        {
            var options = await Service().GetOptionsAsync(_ownerId, _product.Id);

            Assert.True(options.CanPublish);
            Assert.Equal("rose_store", options.Username);
            Assert.Equal(new[] { "/uploads/products/a.png", "/uploads/products/b.png" }, options.Images);
            Assert.Equal(3, options.QuotaUsage);
            Assert.Contains("عطر الورد", options.SuggestedCaption);
            Assert.Contains("25,000", options.SuggestedCaption);
            Assert.Contains("#عطور_نسائية", options.SuggestedCaption);
            InstagramPublishService.ValidateCaption(options.SuggestedCaption);
        }

        [Fact]
        public async Task CancelAndRetry_OnlyFromAllowedStates()
        {
            var dto = Request();
            dto.ScheduledAt = _time.GetUtcNow().UtcDateTime.AddHours(1);
            var scheduled = await Service().CreateAsync(_ownerId, dto);

            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().RetryAsync(_ownerId, scheduled.Id));
            var cancelled = await Service().CancelAsync(_ownerId, scheduled.Id);
            Assert.Equal(InstagramPost.StatusCancelled, cancelled.Status);
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().CancelAsync(_ownerId, scheduled.Id));
        }

        // ===================================
        // تجهيز الصور (Skia حقيقي)
        // ===================================
        [Fact]
        public async Task ImagePreparer_ProducesSquareJpegWithWhiteBackground()
        {
            var root = Path.Combine(Path.GetTempPath(), "igprep-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(Path.Combine(root, "uploads", "products"));
            try
            {
                // صورة PNG طولية شفافة
                using (var bmp = new SKBitmap(new SKImageInfo(200, 400, SKColorType.Rgba8888, SKAlphaType.Premul)))
                {
                    bmp.Erase(SKColors.Transparent);
                    using var data = SKImage.FromBitmap(bmp).Encode(SKEncodedImageFormat.Png, 100);
                    await File.WriteAllBytesAsync(Path.Combine(root, "uploads", "products", "t.png"), data.ToArray());
                }
                var env = new Mock<IWebHostEnvironment>();
                env.Setup(e => e.WebRootPath).Returns(root);
                var preparer = new InstagramImagePreparer(env.Object);

                var url = await preparer.PrepareAsync("/uploads/products/t.png");

                Assert.StartsWith("/uploads/social/ig-", url);
                var path = Path.Combine(root, url.TrimStart('/'));
                using (var codec = SKCodec.Create(path))
                {
                    Assert.Equal(SKEncodedImageFormat.Jpeg, codec.EncodedFormat);
                    Assert.Equal(InstagramImagePreparer.Size, codec.Info.Width);
                    Assert.Equal(InstagramImagePreparer.Size, codec.Info.Height);
                }
                using (var result = SKBitmap.Decode(path))
                {
                    var corner = result.GetPixel(5, 5);
                    Assert.True(corner.Red > 245 && corner.Green > 245 && corner.Blue > 245);
                }

                await Assert.ThrowsAsync<InvalidOperationException>(() => preparer.PrepareAsync("/uploads/../secret.txt"));
                await Assert.ThrowsAsync<InvalidOperationException>(() => preparer.PrepareAsync("C:/Windows/win.ini"));

                var vendorUpload = Path.Combine(root, "uploads", "social", "v-store", "clip.mp4");
                Directory.CreateDirectory(Path.GetDirectoryName(vendorUpload)!);
                await File.WriteAllBytesAsync(vendorUpload, new byte[] { 1 });

                preparer.Delete(new[] { url, "/uploads/products/t.png", "/uploads/social/v-store/clip.mp4" });
                Assert.False(File.Exists(path));
                Assert.True(File.Exists(Path.Combine(root, "uploads", "products", "t.png")));   // صور المنتجات لا تُحذف
                Assert.True(File.Exists(vendorUpload));                                        // ولا مرفوعات التاجر
            }
            finally
            {
                Directory.Delete(root, true);
            }
        }

        // ===================================
        // رفع الوسائط (ملفات حقيقية في مجلد مؤقت)
        // ===================================
        [Fact]
        public async Task MediaStore_ValidatesContentAndScopesFilesToVendor()
        {
            var root = Path.Combine(Path.GetTempPath(), "igup-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(root);
            try
            {
                var env = new Mock<IWebHostEnvironment>();
                env.Setup(e => e.WebRootPath).Returns(root);
                var store = new SocialMediaStore(_context, env.Object, NullLogger<SocialMediaStore>.Instance);

                using var bmp = new SKBitmap(20, 20);
                var png = SKImage.FromBitmap(bmp).Encode(SKEncodedImageFormat.Png, 100).ToArray();
                var mp4 = new byte[] { 0, 0, 0, 24, (byte)'f', (byte)'t', (byte)'y', (byte)'p', (byte)'i', (byte)'s', (byte)'o', (byte)'m', 0, 0 };

                var image = await store.UploadAsync(_ownerId, FormFile("photo.PNG", png));
                var video = await store.UploadAsync(_ownerId, FormFile("clip.mov", mp4));

                Assert.Equal(SocialMediaStore.TypeImage, image.Type);
                Assert.Equal(SocialMediaStore.TypeVideo, video.Type);
                Assert.StartsWith($"/uploads/social/v-{_store.Id:N}/", video.Url);
                Assert.True(store.IsVendorUpload(_store.Id, image.Url));
                Assert.True(store.IsVendorUpload(_store.Id, video.Url));
                Assert.False(store.IsVendorUpload(Guid.NewGuid(), video.Url));                                  // متجر آخر
                Assert.False(store.IsVendorUpload(_store.Id, $"/uploads/social/v-{_store.Id:N}/../../products/x.png"));
                Assert.False(store.IsVendorUpload(_store.Id, $"/uploads/social/v-{_store.Id:N}/missing.mp4"));

                // امتداد صحيح بمحتوى مزيف، وصيغة غير مدعومة
                await Assert.ThrowsAsync<BusinessRuleException>(() => store.UploadAsync(_ownerId, FormFile("fake.mp4", png)));
                await Assert.ThrowsAsync<BusinessRuleException>(() => store.UploadAsync(_ownerId, FormFile("fake.jpg", mp4)));
                await Assert.ThrowsAsync<BusinessRuleException>(() => store.UploadAsync(_ownerId, FormFile("doc.pdf", png)));
                await Assert.ThrowsAsync<ForbiddenException>(() => store.UploadAsync(Guid.NewGuid(), FormFile("photo.png", png)));

                // التنظيف: القديم غير المستخدم يُحذف، والمستخدم أو الحديث يبقى
                var oldPath = Path.Combine(root, image.Url.TrimStart('/'));
                var keptPath = Path.Combine(root, video.Url.TrimStart('/'));
                File.SetLastWriteTimeUtc(oldPath, DateTime.UtcNow.AddDays(-3));
                File.SetLastWriteTimeUtc(keptPath, DateTime.UtcNow.AddDays(-3));
                Assert.Equal(1, store.CleanupUnused(new HashSet<string> { video.Url }, DateTime.UtcNow.AddDays(-1)));
                Assert.False(File.Exists(oldPath));
                Assert.True(File.Exists(keptPath));
            }
            finally
            {
                Directory.Delete(root, true);
            }
        }

        private static IFormFile FormFile(string name, byte[] bytes) =>
            new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", name);

        private sealed class FakeTime : TimeProvider
        {
            private DateTimeOffset _now;
            public FakeTime(DateTimeOffset now) => _now = now;
            public override DateTimeOffset GetUtcNow() => _now;
            public void Advance(TimeSpan by) => _now += by;
        }
    }
}
