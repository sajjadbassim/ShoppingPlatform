using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Return;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services.FileService;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;
using ecommerce.Core.Exceptions;

namespace ecommerce.Services
{
    public class ReturnService : IReturnService
    {
        private readonly IReturnRepository _returnRepository;
        private readonly IFileService _fileService;
        private readonly AppDbContext _context;
        private readonly INotificationService _notificationService;

        private readonly ecommerce.Services.FinanceService.IFinanceService? _finance;
        private readonly ecommerce.Services.ILoyaltyService? _loyalty;

        public ReturnService(
            IReturnRepository returnRepository,
            IFileService fileService,
            AppDbContext context,
            INotificationService notificationService,
            ecommerce.Services.FinanceService.IFinanceService? finance = null,
            ecommerce.Services.ILoyaltyService? loyalty = null)
        {
            _finance = finance;
            _loyalty = loyalty;
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
                throw new NotFoundException("طلب الإرجاع غير موجود");

            return (await WithPickupAsync(new[] { MapToDto(returnRequest) })).Single();
        }

        public async Task<ReturnResponseDto> GetForViewerAsync(Guid id, Guid viewerId, bool isStaff)
        {
            var returnRequest = await _returnRepository.GetByIdWithDetailsAsync(id);
            // طلب غيره يُعامل كغير موجود — لا يكشف وجود الرقم ولا بيانات الزبون الآخر.
            // المتجر يرى إرجاعاً فيه قطع من منتجاته
            if (returnRequest == null)
                throw new NotFoundException("طلب الإرجاع غير موجود");
            if (!isStaff && returnRequest.CustomerId != viewerId)
            {
                var vendorIds = returnRequest.Items.Select(i => i.Product?.VendorId).Where(v => v != null).Distinct().ToList();
                var member = await ecommerce.Core.Constants.VendorMembership.VendorIdOfAsync(_context, viewerId);
                var myVendor = member != null && vendorIds.Contains(member) ? member
                    : throw new NotFoundException("طلب الإرجاع غير موجود");

                // إرجاع مشترك بين متجرين: كل متجر يرى قطعه فقط، بلا مبالغ الزبون (الاسترجاع وخصم النقاط للطلب كله)
                var dto = MapToDto(returnRequest);
                var mine = returnRequest.Items.Where(i => i.Product?.VendorId == myVendor).Select(i => i.Id).ToHashSet();
                dto.Items = dto.Items.Where(i => returnRequest.Items.Any(ri => mine.Contains(ri.Id) && ri.ProductId == i.ProductId && ri.VariantId == i.VariantId)).ToList();
                dto.RefundAmount = null;
                dto.PointsDeductionAmount = null;
                dto = (await WithPickupAsync(new[] { dto })).Single();
                dto.PickupFeeAmount = dto.PickupFeePayer == RefusalFeePayer.Vendor ? dto.PickupFeeAmount : 0;
                return dto;
            }

            return (await WithPickupAsync(new[] { MapToDto(returnRequest) })).Single();
        }

        // ===================================
        // GetMyReturnsAsync
        // ===================================
        public async Task<IEnumerable<ReturnResponseDto>> GetMyReturnsAsync(Guid customerId)
        {
            var returns = await _returnRepository.GetByCustomerAsync(customerId);
            return await WithPickupAsync(returns.Select(MapToDto));
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
            return (await WithPickupAsync(returns.Select(MapToDto)), totalCount);
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
                    throw new NotFoundException("الطلب غير موجود");

                // طلب غيره يُعامل كغير موجود (لا يكشف وجود الرقم) — مثل باقي واجهات الطلبات
                if (order.CustomerId != customerId)
                    throw new NotFoundException("الطلب غير موجود");

                // 2️⃣ التحقق أن الطلب مسلّم
                if (order.Status != OrderStatus.DELIVERED)
                    throw new BusinessRuleException("لا يمكن إرجاع طلب لم يتم تسليمه بعد");

                // 3️⃣ التحقق من نافذة الإرجاع (14 يوم)
                var withinWindow = await _returnRepository.IsWithinReturnWindowAsync(dto.OrderId);
                if (!withinWindow)
                    throw new BusinessRuleException("انتهت مدة الإرجاع المسموح بها (14 يوماً من تاريخ التسليم)");

                // 4️⃣ التحقق من عدم وجود طلب إرجاع نشط مسبقاً
                var hasActiveReturn = await _returnRepository.HasActiveReturnForOrderAsync(dto.OrderId);
                if (hasActiveReturn)
                    throw new BusinessRuleException("يوجد طلب إرجاع نشط لهذا الطلب مسبقاً");

                // 5️⃣ التحقق أن المنتجات وصلت الزبون فعلاً: من طلب متجر مُسلَّم (لا ما رفضه المتجر أو أزاله لعدم توفره)
                var orderItems = order.SubOrders
                    .Where(so => so.Status == OrderStatus.DELIVERED)
                    .SelectMany(so => so.Items)
                    .Where(oi => oi.Quantity - oi.RefusedQuantity > 0)
                    .ToList();

                // ما أُرجع سابقاً (غير المرفوض) يُخصم مما يمكن إرجاعه — الرفض عند الباب محسوب في RefusedQuantity
                var returnedBefore = await _context.ReturnItems.AsNoTracking()
                    .Where(ri => ri.Return.OrderId == order.Id && ri.Return.Status != ReturnStatus.REJECTED && !ri.Return.IsDoorRefusal)
                    .Select(ri => new { ri.ProductId, ri.VariantId, ri.Quantity })
                    .ToListAsync();

                var returnItems = new List<ReturnItem>();
                foreach (var item in dto.Items)
                {
                    // المتغير يحدد البند بدقة عندما يحتوي الطلب على أكثر من متغير لنفس المنتج
                    var orderItem = orderItems.FirstOrDefault(oi =>
                        oi.ProductId == item.ProductId &&
                        (item.VariantId == null || oi.VariantId == item.VariantId));
                    if (orderItem == null)
                    {
                        // قطعة رفضها عند الباب أو لم تصله أصلاً (متجر ملغى/غير متوفر)
                        var refusedAtDoor = order.SubOrders.SelectMany(so => so.Items).Any(oi => oi.ProductId == item.ProductId
                            && (item.VariantId == null || oi.VariantId == item.VariantId) && oi.RefusedQuantity > 0);
                        throw new BusinessRuleException(refusedAtDoor
                            ? "رفضت هذه القطعة عند الاستلام فعادت للمتجر ولم تدفع ثمنها — لا تحتاج إرجاعاً"
                            : "هذه القطعة لم تُسلَّم لك ضمن هذا الطلب");
                    }

                    var received = orderItem.Quantity - orderItem.RefusedQuantity
                        - returnedBefore.Where(r => r.ProductId == orderItem.ProductId && r.VariantId == orderItem.VariantId).Sum(r => r.Quantity);
                    if (item.Quantity > received)
                        throw new BusinessRuleException($"الكمية المطلوبة للإرجاع ({item.Quantity}) أكبر من الكمية المستلمة ({Math.Max(0, received)})");

                    returnItems.Add(new ReturnItem
                    {
                        ProductId = item.ProductId,
                        VariantId = orderItem.VariantId,
                        ProductName = orderItem.ProductNameAr ?? orderItem.ProductName,
                        Quantity = item.Quantity,
                        UnitPrice = orderItem.UnitPrice
                    });
                }

                // 6️⃣ إنشاء طلب الإرجاع
                if (!ReturnReason.All.Contains(dto.Reason.ToLower()))
                    throw new BusinessRuleException("سبب الإرجاع غير صالح");

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
                        throw new BusinessRuleException("لا يمكن رفع أكثر من 5 صور");

                    List<string> uploadedImages = new List<string>();

                    try
                    {
                        uploadedImages = await _fileService.SaveImagesAsync(dto.Images, "returns");

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
                        if (ex is AppException) throw new BusinessRuleException($"فشل رفع الصور: {ex.Message}");
                        throw;
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
                    // العمليات تراجع الإرجاعات أيضاً (/operations/customer-returns)
                    await _notificationService.NotifyOpsAsync(
                        NotificationCategory.Returns, NotificationType.RETURN,
                        $"طلب إرجاع جديد: {created.ReturnNumber}",
                        new { returnId = created.Id });
                    await NotifyVendorsAsync(created.Id, $"طلب إرجاع جديد {created.ReturnNumber} على منتجاتك — بانتظار مراجعة الإدارة");
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
            await using var returnLock = await OrderLock.ForReturnAsync(_context, returnId);
            var returnRequest = await _returnRepository.GetByIdAsync(returnId);
            if (returnRequest == null)
                throw new NotFoundException("طلب الإرجاع غير موجود");

            if (returnRequest.Status != ReturnStatus.PENDING)
                throw new BusinessRuleException("هذا الطلب تمت مراجعته مسبقاً");

            var validDecisions = new[] { "approved", "rejected" };
            if (!validDecisions.Contains(dto.Decision.ToLower()))
                throw new BusinessRuleException("اختر القرار: موافقة أو رفض");

            if (dto.Decision.ToLower() == "rejected" && string.IsNullOrWhiteSpace(dto.RejectionReason))
                throw new BusinessRuleException("سبب الرفض مطلوب عند رفض طلب الإرجاع");

            returnRequest.Status = dto.Decision.ToLower() == "approved"
                ? ReturnStatus.APPROVED
                : ReturnStatus.REJECTED;
            returnRequest.ReviewedBy = reviewedBy;
            returnRequest.ReviewedAt = DateTime.UtcNow;
            returnRequest.RejectionReason = dto.RejectionReason;
            if (returnRequest.Status == ReturnStatus.APPROVED)
            {
                returnRequest.RefundAmount = await RefundAmountAsync(returnRequest);
                // أجرة استلام القطع من الزبون (أجرة توصيل متاجرها) — من يتحمّلها حسب إعداد الإدارة
                var (fee, payer) = await PickupFeeAsync(returnRequest);
                returnRequest.PickupFeeAmount = fee;
                returnRequest.PickupFeePayer = payer;
                if (payer == RefusalFeePayer.Customer && fee > 0)
                    returnRequest.RefundAmount = Math.Max(0, (returnRequest.RefundAmount ?? 0) - fee);
            }

            await _returnRepository.UpdateAsync(returnRequest);
            var points = ReturnPointsReversal.None;
            if (returnRequest.Status == ReturnStatus.APPROVED)
            {
                // نقاط القطع المُرجعة تُخصم من الزبون (قيد عكسي). الخصم من المتجر وعودة المخزون حين تصله القطع
                if (_loyalty != null) points = await _loyalty.ReverseReturnPointsAsync(returnRequest.Id);
                // نقاط القطع المُرجعة صرفها الزبون قبل الإرجاع: قيمتها تُخصم من المبلغ المسترجع
                // (وإلا يشتري قطعة غالية، يصرف نقاطها، ثم يُرجعها ويسترجع ثمنها كاملاً)
                if (points.ShortfallValue > 0)
                {
                    var deduction = Math.Min(points.ShortfallValue, returnRequest.RefundAmount ?? 0);
                    returnRequest.PointsDeductionAmount = deduction;
                    returnRequest.RefundAmount = (returnRequest.RefundAmount ?? 0) - deduction;
                    await _returnRepository.UpdateAsync(returnRequest);
                }
            }

            await NotifyCustomerAsync(returnRequest, returnRequest.Status == ReturnStatus.APPROVED
                ? $"تمت الموافقة على طلب الإرجاع {returnRequest.ReturnNumber} — سيأتيك سائق لاستلام القطع، ويُردّ لك {returnRequest.RefundAmount:N0} د.ع بعد وصولها للمتجر" +
                  (returnRequest.PickupFeePayer == RefusalFeePayer.Customer && returnRequest.PickupFeeAmount > 0 ? $" (بعد خصم أجرة الاستلام {returnRequest.PickupFeeAmount:N0} د.ع)" : "") +
                  (points.Deducted > 0 ? $"، وخُصمت {points.Deducted:N0} نقطة كانت مكتسبة من القطع المُرجعة" : "") +
                  (returnRequest.PointsDeductionAmount > 0 ? $"، وخُصم {returnRequest.PointsDeductionAmount:N0} د.ع قيمة نقاط هذه القطع التي استخدمتها سابقاً" : "")
                : $"تم رفض طلب الإرجاع {returnRequest.ReturnNumber}: {dto.RejectionReason}");
            if (returnRequest.Status == ReturnStatus.APPROVED)
            {
                await NotifyVendorsAsync(returnRequest.Id, $"تمت الموافقة على الإرجاع {returnRequest.ReturnNumber} — يأخذ السائق القطع من الزبون ويوصلها إليك؛ أكّد استلامها حين تصل");
                try
                {
                    await _notificationService.NotifyOpsAsync(NotificationCategory.Returns, NotificationType.RETURN,
                        $"الإرجاع {returnRequest.ReturnNumber} بانتظار تعيين سائق لاستلام القطع من الزبون", new { returnId = returnRequest.Id });
                }
                catch { /* الإشعار لا يُفشل القرار */ }
            }
            return await GetByIdAsync(returnId);
        }

        // ===================================
        // MarkRefundedAsync (Admin/Ops) — ردّ المبلغ للزبون فعلاً: الإرجاع يصبح «مكتمل»
        // ===================================
        public async Task<ReturnResponseDto> MarkRefundedAsync(Guid returnId, Guid refundedBy)
        {
            await using var returnLock = await OrderLock.ForReturnAsync(_context, returnId);
            var returnRequest = await _returnRepository.GetByIdAsync(returnId)
                ?? throw new NotFoundException("طلب الإرجاع غير موجود");
            if (returnRequest.Status == ReturnStatus.COMPLETED)
                throw new BusinessRuleException("تم تسجيل ردّ المبلغ مسبقاً");
            if (returnRequest.Status != ReturnStatus.APPROVED)
                throw new BusinessRuleException("لا يُردّ المبلغ إلا بعد الموافقة على الإرجاع");
            if (returnRequest.IsDoorRefusal)
                throw new BusinessRuleException("رفض عند الاستلام — لم يدفع الزبون ثمن هذه القطع، فلا مبلغ لردّه");
            if (returnRequest.ItemsReceivedAt == null)
                throw new BusinessRuleException("لم تصل القطع للمتجر بعد — يُردّ المبلغ بعد أن يؤكد المتجر استلامها");

            returnRequest.RefundAmount ??= await RefundAmountAsync(returnRequest);
            returnRequest.Status = ReturnStatus.COMPLETED;
            returnRequest.RefundedAt = DateTime.UtcNow;
            returnRequest.RefundedBy = refundedBy;
            await _returnRepository.UpdateAsync(returnRequest);

            await NotifyCustomerAsync(returnRequest, $"تم ردّ مبلغ الإرجاع {returnRequest.ReturnNumber}: {returnRequest.RefundAmount:N0} د.ع");
            return await GetByIdAsync(returnId);
        }

        // ===================================
        // استثناء أجرة استلام المرتجع (العمليات/الأدمن): مثلاً القطعة معيبة فلا يدفع الزبون أجرة إرجاعها.
        // بعد الموافقة وقبل أن تصل القطع للمتجر فقط — عند وصولها تُسجَّل الأجرة على المتجر ويُفتح الردّ
        // ===================================
        public async Task<ReturnResponseDto> SetPickupFeePayerAsync(Guid returnId, string payer, string? reason, Guid userId)
        {
            if (!RefusalFeePayer.All.Contains(payer))
                throw new BusinessRuleException("اختر من يتحمّل الأجرة");
            var why = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
            if (why == null)
                throw new BusinessRuleException("اكتب سبب التغيير");
            if (why.Length > 300)
                throw new BusinessRuleException("السبب طويل — 300 حرف كحد أقصى");

            var orderId = await _context.Returns.AsNoTracking().Where(r => r.Id == returnId)
                .Select(r => (Guid?)r.OrderId).FirstOrDefaultAsync()
                ?? throw new NotFoundException("طلب الإرجاع غير موجود");
            // قفل الطلب أولاً (يأخذه تأكيد المتجر لاستلام القطع) ثم قفل الإرجاع — نفس الترتيب دائماً
            await using var orderLock = await OrderLock.ForOrderAsync(_context, orderId);
            await using var returnLock = await OrderLock.ForReturnAsync(_context, returnId);

            var r = await _context.Returns.FirstAsync(x => x.Id == returnId);
            if (r.IsDoorRefusal)
                throw new BusinessRuleException("رفض عند الاستلام — أجرته تُضبط من شاشة الطلب قبل أن يسجّل السائق الرفض");
            if (r.Status != ReturnStatus.APPROVED || r.PickupFeePayer == null)
                throw new BusinessRuleException("تُغيَّر أجرة الاستلام بعد الموافقة على الإرجاع فقط");
            if (r.ItemsReceivedAt != null)
                throw new BusinessRuleException("وصلت القطع للمتجر وسُجّلت الحسابات — لا تُغيَّر الأجرة بعدها");
            if (r.PickupFeePayer == payer)
                return await GetByIdAsync(returnId);

            var (fee, _) = await PickupFeeAsync(r, payer);
            // المبلغ المردود من جديد: قيمة القطع − أجرة الزبون (إن كانت عليه) − قيمة النقاط المخصومة سابقاً
            var customerFee = payer == RefusalFeePayer.Customer ? fee : 0;
            var refund = Math.Max(0, await RefundAmountAsync(r) - customerFee);
            r.RefundAmount = Math.Max(0, refund - (r.PointsDeductionAmount ?? 0));
            r.PickupFeeAmount = fee;
            r.PickupFeePayer = payer;
            r.PickupFeeOverrideReason = why;
            r.UpdatedAt = DateTime.UtcNow;

            // مهام الاستلام المفتوحة تتبع الأجرة الجديدة (المنصة = بلا أجرة)
            var trips = await _context.ReturnTrips.Include(t => t.SubOrder)
                .Where(t => t.ReturnId == returnId && ReturnTripStatus.Open.Contains(t.Status)).ToListAsync();
            foreach (var t in trips)
                t.DeliveryFee = payer == RefusalFeePayer.None ? 0 : t.SubOrder.DeliveryFee;
            await _context.SaveChangesAsync();

            await NotifyCustomerAsync(r, $"أجرة استلام الإرجاع {r.ReturnNumber} صارت على {RefusalFeePayer.Ar(payer)} — " +
                $"يُردّ لك {r.RefundAmount:N0} د.ع بعد وصول القطع للمتجر");
            return await GetByIdAsync(returnId);
        }

        // المستحق للزبون: قيمة القطع المُرجعة ناقص نصيبها من خصم الطلب (لا يُردّ ما لم يدفعه)
        private async Task<decimal> RefundAmountAsync(Return r)
        {
            if (r.IsDoorRefusal) return 0;
            var items = await _context.ReturnItems.AsNoTracking().Where(i => i.ReturnId == r.Id).ToListAsync();
            var order = await _context.Orders.AsNoTracking().Include(o => o.SubOrders).ThenInclude(so => so.Items)
                .FirstOrDefaultAsync(o => o.Id == r.OrderId);
            if (order == null) return items.Sum(i => i.UnitPrice * i.Quantity);
            var shares = OrderTotals.DiscountShares(order, order.SubOrders);

            decimal refund = 0;
            foreach (var item in items)
            {
                var value = item.UnitPrice * item.Quantity;
                var so = order.SubOrders.FirstOrDefault(s => s.Status != OrderStatus.CANCELLED
                    && s.Items.Any(i => i.ProductId == item.ProductId && i.VariantId == item.VariantId));
                var discount = so == null || so.Subtotal <= 0 ? 0 : shares.GetValueOrDefault(so.Id) * value / so.Subtotal;
                refund += Math.Max(0, value - discount);
            }
            return Math.Round(refund, 0);
        }

        // أجرة الاستلام = مجموع أجور توصيل المتاجر التي تعود إليها القطع (رحلة لكل متجر، كما في الطلب)
        // payer: استثناء العمليات لهذا الإرجاع — وإلا إعداد الأدمن
        private async Task<(decimal Fee, string Payer)> PickupFeeAsync(Return r, string? payer = null)
        {
            payer ??= await _context.DeliverySettings.AsNoTracking().Select(s => s.ReturnPickupFeePayer).FirstOrDefaultAsync()
                ?? RefusalFeePayer.Customer;
            var vendorIds = await _context.ReturnItems.AsNoTracking().Where(i => i.ReturnId == r.Id)
                .Select(i => i.Product.VendorId).Distinct().ToListAsync();
            var fee = await _context.SubOrders.AsNoTracking()
                .Where(so => so.OrderId == r.OrderId && vendorIds.Contains(so.VendorId) && so.Status == OrderStatus.DELIVERED)
                .SumAsync(so => so.DeliveryFee);
            return (payer == RefusalFeePayer.None ? 0 : fee, payer);
        }

        // حالة استلام القطع من الزبون (من مهام الإرجاع)
        private async Task<List<ReturnResponseDto>> WithPickupAsync(IEnumerable<ReturnResponseDto> dtos)
        {
            var list = dtos.ToList();
            var ids = list.Where(d => !d.IsDoorRefusal && d.Status is ReturnStatus.APPROVED or ReturnStatus.COMPLETED).Select(d => d.Id).ToList();
            if (ids.Count == 0) return list;
            var trips = await _context.ReturnTrips.AsNoTracking()
                .Where(t => t.ReturnId != null && ids.Contains(t.ReturnId.Value) && t.Reason == ReturnTripReason.CustomerReturn)
                .Select(t => new { ReturnId = t.ReturnId!.Value, t.Status, DriverName = t.Driver.FullName })
                .ToListAsync();
            var received = await _context.Returns.AsNoTracking().Where(r => ids.Contains(r.Id))
                .Select(r => new { r.Id, r.ItemsReceivedAt, r.PickupFeeAmount, r.PickupFeePayer, r.PickupFeeOverrideReason }).ToDictionaryAsync(r => r.Id);
            foreach (var d in list.Where(d => ids.Contains(d.Id)))
            {
                var r = received[d.Id];
                var mine = trips.Where(t => t.ReturnId == d.Id).ToList();
                d.ItemsReceivedAt = r.ItemsReceivedAt;
                d.PickupFeeAmount = r.PickupFeeAmount;
                d.PickupFeePayer = r.PickupFeePayer;
                d.PickupFeeOverrideReason = r.PickupFeeOverrideReason;
                d.PickupDriverName = mine.FirstOrDefault()?.DriverName;
                d.PickupStatus = r.ItemsReceivedAt != null ? "RECEIVED"
                    : mine.Count == 0 ? "AWAITING_DRIVER"
                    : mine.Any(t => t.Status == ReturnTripStatus.AtCustomer) ? "DRIVER_ASSIGNED"
                    : "WITH_DRIVER";
                d.PickupStatusAr = d.PickupStatus switch
                {
                    "AWAITING_DRIVER" => "بانتظار تعيين سائق لاستلام القطع",
                    "DRIVER_ASSIGNED" => "السائق في طريقه لاستلام القطع",
                    "WITH_DRIVER" => "القطع مع السائق في طريقها للمتجر",
                    _ => "وصلت القطع للمتجر",
                };
                d.CanRefund = d.Status == ReturnStatus.APPROVED && r.ItemsReceivedAt != null;
            }
            return list;
        }

        // متاجر القطع المُرجعة: تعرف بالطلب وبالقرار (القطع تعود إليها وتُخصم قيمتها من رصيدها)
        private async Task NotifyVendorsAsync(Guid returnId, string message)
        {
            try
            {
                var orderId = await _context.Returns.AsNoTracking().Where(r => r.Id == returnId).Select(r => r.OrderId).FirstAsync();
                var vendors = await _context.ReturnItems.AsNoTracking().Where(i => i.ReturnId == returnId)
                    .Select(i => i.Product.VendorId).Distinct().ToListAsync();
                // الطلب مع الإرجاع: الإشعار يفتح طلب المتجر حيث يظهر الإرجاع
                foreach (var v in vendors)
                    await _notificationService.NotifyVendorAsync(v, NotificationCategory.Returns, NotificationType.RETURN, message, new { returnId, orderId });
            }
            catch { /* الإشعار لا يُفشل العملية */ }
        }

        private async Task NotifyCustomerAsync(Return r, string message)
        {
            try
            {
                await _notificationService.NotifyCustomerAsync(r.CustomerId, message,
                    new { returnId = r.Id, returnNumber = r.ReturnNumber, orderId = r.OrderId });
            }
            catch { /* الإشعار لا يُفشل القرار */ }
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
            RefundAmount = r.RefundAmount,
            PointsDeductionAmount = r.PointsDeductionAmount,
            IsDoorRefusal = r.IsDoorRefusal,
            RefundedAt = r.RefundedAt,
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