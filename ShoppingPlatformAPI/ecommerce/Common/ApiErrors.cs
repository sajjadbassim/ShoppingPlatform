using ecommerce.Core.Exceptions;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Common
{
    // رد خطأ من catch في الـcontroller بنفس شكل { success, message } لكن برمز الحالة الصحيح —
    // كان كل AppException يُعاد 400 فيضيع 404 (غير موجود) و409 (تعارض) و403 و429.
    // UnauthorizedException يبقى 400 هنا: 401 يجعل الواجهة تجدّد الجلسة وتحوّل لصفحة الدخول (خطأ كلمة المرور مثلاً)
    public static class ApiErrors
    {
        public static ObjectResult From(Exception ex) => new(new { success = false, message = ex.Message })
        {
            StatusCode = ex switch
            {
                NotFoundException => StatusCodes.Status404NotFound,
                ConflictException => StatusCodes.Status409Conflict,
                ForbiddenException or UnauthorizedAccessException => StatusCodes.Status403Forbidden,
                TooManyAttemptsException => StatusCodes.Status429TooManyRequests,
                _ => StatusCodes.Status400BadRequest,
            },
        };
    }
}
