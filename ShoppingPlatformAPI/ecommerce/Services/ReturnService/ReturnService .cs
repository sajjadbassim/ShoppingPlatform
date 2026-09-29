using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Return;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services.FileService;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services
{
    public class ReturnService : IReturnService
    {
        private readonly IReturnRepository _returnRepository;
        private readonly IFileService _fileService;
        private readonly AppDbContext _context;
        private readonly INotificationService _notificationService;

        public ReturnService(
            IReturnRepository returnRepository,
            IFileService fileService,
            AppDbContext context,
            INotificationService notificationService)
        {
            _returnRepository = returnRepository;
            _fileService = fileService;
            _context = context;
            _notificationService = notificationService;
        }

        // ===================================
        // GetByIdAsync
        // ===================================
        public async Task<ReturnResponseDto> GetByIdAsync(Guid id)
        {
            var returnRequest = await _returnRepository.GetByIdWithDetailsAsync(id);
            if (returnRequest == null)
                throw new Exception("طلب الإرجاع غير موجود");

            return MapToDto(returnRequest);
        }

        // ===================================
        // GetMyReturnsAsync
        // ===================================
        public async Task<IEnumerable<ReturnResponseDto>> GetMyReturnsAsync(Guid customerId)
        {
            var returns = await _returnRepository.GetByCustomerAsync(customerId);
            return returns.Select(MapToDto);
        }

        // ===================================
        // GetPagedAsync (Admin/Ops)
        // ===================================
        public async Task<(IEnumerable<ReturnResponseDto> Returns, int TotalCount)> GetPagedAsync(
            string? status = null,
            int pageNumber = 1,
            int pageSize = 20)
        {
            var (returns, totalCount) = await _returnRepository.GetPagedAsync(status, pageNumber, pageSize);
            return (returns.Select(MapToDto), totalCount);
        }

        // ===================================
        // CreateAsync - مع Transaction للأمان
        // ===================================
        public async Task<ReturnResponseDto> CreateAsync(Guid customerId, CreateReturnDto dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // 1️⃣ التحقق أن الطلب موجود وينتمي للعميل
                var order = await _context.Orders
                    .Include(o => o.SubOrders)
                        .ThenInclude(so => so.Items)
                            .ThenInclude(i => i.Product)
                    .FirstOrDefaultAsync(o => o.Id == dto.OrderId);

                if (order == null)
                    throw new Exception("الطلب غير موجود");

                if (order.CustomerId != customerId)
                    throw new UnauthorizedAccessException("ليس لديك صلاحية لإرجاع هذا الطلب");

                // 2️⃣ التحقق أن الطلب مسلّم
                if (order.Status != OrderStatus.DELIVERED)
                    throw new Exception("لا يمكن إرجاع طلب لم يتم تسليمه بعد");

                // 3️⃣ التحقق من نافذة الإرجاع (14 يوم)
                var withinWindow = await _returnRepository.IsWithinReturnWindowAsync(dto.OrderId);
                if (!withinWindow)
                    throw new Exception("انتهت مدة الإرجاع المسموح بها (14 يوماً من تاريخ التسليم)");

                // 4️⃣ التحقق من عدم وجود طلب إرجاع نشط مسبقاً
                var hasActiveReturn = await _returnRepository.HasActiveReturnForOrderAsync(dto.OrderId);
                if (hasActiveReturn)
                    throw new Exception("يوجد طلب إرجاع نشط لهذا الطلب مسبقاً");

                // 5️⃣ التحقق أن المنتجات موجودة في الطلب
                var orderItems = order.SubOrders
                    .SelectMany(so => so.Items)
                    .ToList();

                var returnItems = new List<ReturnItem>();
                foreach (var item in dto.Items)
                {
                    // المتغير يحدد البند بدقة عندما يحتوي الطلب على أكثر من متغير لنفس المنتج
                    var orderItem = orderItems.FirstOrDefault(oi =>
                        oi.ProductId == item.ProductId &&
                        (item.VariantId == null || oi.VariantId == item.VariantId));
                    if (orderItem == null)
                        throw new Exception($"المنتج غير موجود في هذا الطلب");

                    if (item.Quantity > orderItem.Quantity)
                        throw new Exception($"الكمية المطلوبة للإرجاع ({item.Quantity}) أكبر من الكمية المشتراة ({orderItem.Quantity})");

                    returnItems.Add(new ReturnItem
                    {
                        ProductId = item.ProductId,
                        VariantId = orderItem.VariantId,
                        ProductName = orderItem.ProductName,
                        Quantity = item.Quantity,
                        UnitPrice = orderItem.UnitPrice
                    });
                }

                // 6️⃣ إنشاء طلب الإرجاع
                if (!ReturnReason.All.Contains(dto.Reason.ToLower()))
                    throw new Exception("سبب الإرجاع غير صالح");

                var returnNumber = await _returnRepository.GenerateReturnNumberAsync();

                var returnRequest = new Return
                {
                    ReturnNumber = returnNumber,
                    OrderId = dto.OrderId,
                    CustomerId = customerId,
                    Status = ReturnStatus.PENDING,
                    Reason = dto.Reason.ToLower(),
                    Details = dto.Details,
                    Items = returnItems
                };

                var created = await _returnRepository.CreateAsync(returnRequest);

                // 7️⃣ رفع الصور إذا وجدت
                if (dto.Images != null && dto.Images.Count > 0)
                {
                    if (dto.Images.Count > 5)
                        throw new Exception("لا يمكن رفع أكثر من 5 صور");

                    List<string> uploadedImages = new List<string>();

                    try
                    {
                        uploadedImages = await _fileService.SaveImagesAsync(dto.Images);

                        var returnImages = new List<ReturnImage>();
                        for (int i = 0; i < uploadedImages.Count; i++)
                        {
                            returnImages.Add(new ReturnImage
                            {
                                ReturnId = created.Id,
                                ImageUrl = uploadedImages[i],
                                DisplayOrder = i
                            });
                        }

                        await _returnRepository.AddImagesAsync(returnImages);
                    }
                    catch (Exception ex)
                    {
                        await _fileService.DeleteImagesAsync(uploadedImages);
                        await transaction.RollbackAsync();
                        throw new Exception($"فشل رفع الصور: {ex.Message}");
                    }
                }

                await transaction.CommitAsync();

                // ✅ إشعار الأدمن بطلب إرجاع جديد
                try
                {
                    await _notificationService.NotifyAdminsAsync(
                        NotificationCategory.Returns, NotificationType.RETURN,
                        $"طلب إرجاع جديد: {created.ReturnNumber}",
                        new { returnId = created.Id });
                }
                catch { /* لا نفشل عملية الإرجاع بسبب فشل الإشعار */ }

                return await GetByIdAsync(created.Id);
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // ===================================
        // ReviewAsync (Admin/Ops)
        // ===================================
        public async Task<ReturnResponseDto> ReviewAsync(Guid returnId, Guid reviewedBy, ReviewReturnDto dto)
        {
            var returnRequest = await _returnRepository.GetByIdAsync(returnId);
            if (returnRequest == null)
                throw new Exception("طلب الإرجاع غير موجود");

            if (returnRequest.Status != ReturnStatus.PENDING)
                throw new Exception("هذا الطلب تمت مراجعته مسبقاً");

            var validDecisions = new[] { "approved", "rejected" };
            if (!validDecisions.Contains(dto.Decision.ToLower()))
                throw new Exception("القرار يجب أن يكون approved أو rejected");

            if (dto.Decision.ToLower() == "rejected" && string.IsNullOrWhiteSpace(dto.RejectionReason))
                throw new Exception("سبب الرفض مطلوب عند رفض طلب الإرجاع");

            returnRequest.Status = dto.Decision.ToLower() == "approved"
                ? ReturnStatus.APPROVED
                : ReturnStatus.REJECTED;
            returnRequest.ReviewedBy = reviewedBy;
            returnRequest.ReviewedAt = DateTime.UtcNow;
            returnRequest.RejectionReason = dto.RejectionReason;

            await _returnRepository.UpdateAsync(returnRequest);
            return await GetByIdAsync(returnId);
        }

        // ===================================
        // Private Helper - MapToDto
        // ===================================
        private static readonly Dictionary<string, string> StatusArMap = new()
        {
            { ReturnStatus.PENDING,   "بانتظار المراجعة" },
            { ReturnStatus.APPROVED,  "تمت الموافقة"     },
            { ReturnStatus.REJECTED,  "مرفوض"            },
            { ReturnStatus.COMPLETED, "مكتمل"            }
        };

        private static readonly Dictionary<string, string> ReasonArMap = new()
        {
            { ReturnReason.DEFECTIVE,        "منتج معيب"           },
            { ReturnReason.WRONG_ITEM,       "منتج خاطئ"           },
            { ReturnReason.NOT_AS_DESCRIBED, "لا يطابق الوصف"      },
            { ReturnReason.CHANGED_MIND,     "تغيير الرأي"         },
            { ReturnReason.OTHER,            "أخرى"                }
        };

        private static ReturnResponseDto MapToDto(Return r) => new()
        {
            Id = r.Id,
            ReturnNumber = r.ReturnNumber,
            OrderId = r.OrderId,
            OrderNumber = r.Order?.OrderNumber ?? string.Empty,
            Status = r.Status,
            StatusAr = StatusArMap.GetValueOrDefault(r.Status, r.Status),
            Reason = r.Reason,
            ReasonAr = ReasonArMap.GetValueOrDefault(r.Reason, r.Reason),
            Details = r.Details,
            RejectionReason = r.RejectionReason,
            CreatedAt = r.CreatedAt,
            ReviewedAt = r.ReviewedAt,
            CustomerName = r.Customer?.FullName ?? r.Order?.Customer?.FullName,
            CustomerPhone = r.Customer?.Phone ?? r.Order?.Customer?.Phone,
            IsRestocked = r.IsRestocked,
            RestockedAt = r.RestockedAt,
            Items = r.Items?.Select(i => new ReturnItemResponseDto
            {
                ProductId = i.ProductId,
                VariantId = i.VariantId,
                ProductName = i.ProductName,
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice
            }).ToList() ?? new(),
            Images = r.Images?.Select(i => i.ImageUrl).ToList() ?? new()
        };
    }
}