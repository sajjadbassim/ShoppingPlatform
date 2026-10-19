using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Loyalty;
using ecommerce.Core.Exceptions;
using ecommerce.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using LoyaltyServiceImpl = ecommerce.Services.LoyaltyService.LoyaltyService;

namespace ecommerce.Tests.Services
{
    // بقية أخطاء جولة 10-18 (القسم 11.3 بنود 8-21)
    public class Run4FixesTests
    {
        // كان الـcontroller يعيد كل AppException بـ400 فيضيع 409 و404
        [Fact]
        public void ApiErrors_KeepsTheRealStatusCode()
        {
            Assert.Equal(StatusCodes.Status409Conflict, ApiErrors.From(new ConflictException("x")).StatusCode);
            Assert.Equal(StatusCodes.Status404NotFound, ApiErrors.From(new NotFoundException("x")).StatusCode);
            Assert.Equal(StatusCodes.Status403Forbidden, ApiErrors.From(new ForbiddenException("x")).StatusCode);
            Assert.Equal(StatusCodes.Status400BadRequest, ApiErrors.From(new BusinessRuleException("x")).StatusCode);
            // 401 يجعل الواجهة تجدّد الجلسة وتحوّل لصفحة الدخول — خطأ كلمة المرور يبقى 400
            Assert.Equal(StatusCodes.Status400BadRequest, ApiErrors.From(new UnauthorizedException("x")).StatusCode);
        }

        [Fact]
        public void StatusFilter_UnknownValue_IsRejected_KnownOrEmptyPasses()
        {
            Assert.Throws<BusinessRuleException>(() => StatusFilter.Validate("BOGUS", typeof(OrderStatus)));
            StatusFilter.Validate(OrderStatus.READY, typeof(OrderStatus));
            StatusFilter.Validate(null, typeof(OrderStatus));
            StatusFilter.Validate("pending", typeof(ReturnStatus), ignoreCase: true);
        }

        [Fact]
        public void StockText_ZeroSaysSoldOut()
        {
            Assert.DoesNotContain("فقط 0", StockText.Available(0, variant: true));
            Assert.Contains("نفد", StockText.Available(0));
            Assert.Contains("فقط 3", StockText.Available(3));
        }

        [Fact]
        public async Task LoyaltySettings_EmptyBody_IsRejected()
        {
            using var context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
            await Assert.ThrowsAsync<BusinessRuleException>(() => new LoyaltyServiceImpl(context).UpdateSettingsAsync(new UpdateLoyaltySettingsDto()));
        }
    }
}
