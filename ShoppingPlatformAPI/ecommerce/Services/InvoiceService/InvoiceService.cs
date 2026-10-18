using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ecommerce.Core.Exceptions;


namespace ecommerce.Services.InvoiceService
{
    public class InvoiceService : IInvoiceService
    {
        private readonly AppDbContext _context;

        public InvoiceService(AppDbContext context)
        {
            _context = context;
        }

        // ===================================
        // GenerateInvoiceAsync
        // ===================================
        public async Task<byte[]> GenerateInvoiceAsync(Guid orderId, Guid requestingUserId, bool isAdmin = false)
        {
            // جلب الطلب مع كل التفاصيل
            var order = await _context.Orders
                .Include(o => o.Customer)
                .Include(o => o.Address)
                .Include(o => o.SubOrders)
                    .ThenInclude(so => so.Vendor)
                .Include(o => o.SubOrders)
                    .ThenInclude(so => so.Items)
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null)
                throw new NotFoundException("الطلب غير موجود");

            // التحقق من الصلاحية
            if (!isAdmin && order.CustomerId != requestingUserId)
                throw new NotFoundException("الطلب غير موجود");

            // التحقق من أن الطلب مكتمل
            if (order.Status != OrderStatus.DELIVERED)
                throw new BusinessRuleException("الفاتورة متاحة فقط للطلبات المسلّمة");

            // أجرة توصيل جزء رفض الزبون استلامه (جُمعت نقداً) — ليست ضمن الإجمالي لأن الجزء أُلغي
            var failedFee = await _context.DriverCashEntries.AsNoTracking()
                .Where(e => e.OrderId == orderId && e.Kind == DriverCashKind.RefusalFee)
                .SumAsync(e => (decimal?)e.Amount) ?? 0;

            // إعداد QuestPDF
            QuestPDF.Settings.License = LicenseType.Community;

            // توليد الـ PDF
            var pdfBytes = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(40);
                    page.DefaultTextStyle(x => x.FontFamily("Arial").FontSize(10));

                    page.Header().Element(ComposeHeader(order));
                    page.Content().Element(ComposeContent(order, failedFee));
                    page.Footer().Element(ComposeFooter(order));
                });
            }).GeneratePdf();

            return pdfBytes;
        }

        // ===================================
        // Header — رأس الفاتورة
        // ===================================
        private static Action<IContainer> ComposeHeader(Order order) => container =>
        {
            container.Column(col =>
            {
                // شريط العنوان
                col.Item().Background("#1a1a2e").Padding(20).Row(row =>
                {
                    row.RelativeItem().Column(inner =>
                    {
                        inner.Item()
                            .Text("فاتورة")
                            .Bold().FontSize(22).FontColor("#ffffff").DirectionFromRightToLeft();

                        inner.Item()
                            .Text("INVOICE")
                            .FontSize(12).FontColor("#aaaacc");
                    });

                    row.ConstantItem(150).Column(inner =>
                    {
                        inner.Item()
                            .AlignRight()
                            .Text($"رقم الطلب")
                            .FontSize(9).FontColor("#aaaacc");

                        inner.Item()
                            .AlignRight()
                            .Text(order.OrderNumber)
                            .Bold().FontSize(14).FontColor("#ffffff");

                        inner.Item()
                            .AlignRight()
                            .Text(IraqTime.FromUtc(order.CreatedAt).ToString("yyyy/MM/dd"))
                            .FontSize(10).FontColor("#ccccee");
                    });
                });

                col.Item().Height(10);

                // معلومات الزبون والتسليم
                col.Item().Row(row =>
                {
                    // معلومات الزبون
                    row.RelativeItem().Border(1).BorderColor("#e0e0e0").Padding(12).Column(inner =>
                    {
                        inner.Item()
                            .Text("بيانات العميل")
                            .Bold().FontSize(11).FontColor("#1a1a2e").DirectionFromRightToLeft();

                        inner.Item().Height(6);

                        inner.Item()
                            .Text(order.Customer?.FullName ?? "—")
                            .FontSize(10).DirectionFromRightToLeft();

                        inner.Item()
                            .Text(order.Customer?.Phone ?? "—")
                            .FontSize(10);

                        inner.Item()
                            .Text(order.Customer?.Email ?? "—")
                            .FontSize(9).FontColor("#666666");
                    });

                    row.ConstantItem(15);

                    // عنوان التسليم
                    row.RelativeItem().Border(1).BorderColor("#e0e0e0").Padding(12).Column(inner =>
                    {
                        inner.Item()
                            .Text("عنوان التسليم")
                            .Bold().FontSize(11).FontColor("#1a1a2e").DirectionFromRightToLeft();

                        inner.Item().Height(6);

                        if (order.Address != null)
                        {
                            inner.Item()
                                .Text($"{order.Address.StreetAddress}")
                                .FontSize(10).DirectionFromRightToLeft();

                            inner.Item()
                                .Text($"{order.Address.Area}، {order.Address.City}")
                                .FontSize(10).DirectionFromRightToLeft();

                            if (!string.IsNullOrEmpty(order.Address.Phone))
                                inner.Item()
                                    .Text($"هاتف: {order.Address.Phone}")
                                    .FontSize(10);
                        }
                    });

                    row.ConstantItem(15);

                    // حالة الطلب
                    col.Item().Height(5);
                });

                col.Item().Height(15);
            });
        };

        // ===================================
        // Content — جدول المنتجات
        // ===================================
        private static Action<IContainer> ComposeContent(Order order, decimal failedFee) => container =>
        {
            container.Column(col =>
            {
                // جدول المنتجات لكل متجر
                foreach (var subOrder in order.SubOrders.OrderBy(so => so.SubOrderNumber))
                {
                    // متجر رفض طلبه أو أُلغي: يظهر للتوضيح فقط بلا بنود، وليس ضمن الإجمالي
                    if (subOrder.Status == OrderStatus.CANCELLED)
                    {
                        col.Item().Background("#fdecea").Padding(8).Row(row =>
                        {
                            row.RelativeItem()
                                .Text($"المتجر: {subOrder.Vendor?.DisplayName ?? "—"} — ملغى، غير محتسب في الفاتورة"
                                      + (string.IsNullOrWhiteSpace(subOrder.CancellationReason) ? "" : $" ({subOrder.CancellationReason})"))
                                .FontSize(10).FontColor("#c0392b").DirectionFromRightToLeft();
                            row.ConstantItem(120).AlignRight()
                                .Text(subOrder.SubOrderNumber).FontSize(9).FontColor("#888888");
                        });
                        col.Item().Height(15);
                        continue;
                    }

                    // اسم المتجر
                    col.Item()
                        .Background("#f0f0f8")
                        .Padding(8)
                        .Row(row =>
                        {
                            row.RelativeItem()
                                .Text($"المتجر: {subOrder.Vendor?.DisplayName ?? "—"}")
                                .Bold().FontSize(11).FontColor("#1a1a2e").DirectionFromRightToLeft();

                            row.ConstantItem(120)
                                .AlignRight()
                                .Text(subOrder.SubOrderNumber)
                                .FontSize(9).FontColor("#666666");
                        });

                    // رأس الجدول
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(30);   // #
                            columns.RelativeColumn(4);    // المنتج
                            columns.RelativeColumn(1.5f); // السعر
                            columns.RelativeColumn(1);    // الكمية
                            columns.RelativeColumn(1.5f); // المجموع
                        });

                        // رأس الجدول
                        table.Header(header =>
                        {
                            header.Cell().Background("#1a1a2e").Padding(6)
                                .Text("#").Bold().FontColor("#ffffff").FontSize(9);

                            header.Cell().Background("#1a1a2e").Padding(6)
                                .Text("المنتج").Bold().FontColor("#ffffff").FontSize(9).DirectionFromRightToLeft();

                            header.Cell().Background("#1a1a2e").Padding(6)
                                .AlignRight().Text("السعر").Bold().FontColor("#ffffff").FontSize(9);

                            header.Cell().Background("#1a1a2e").Padding(6)
                                .AlignCenter().Text("الكمية").Bold().FontColor("#ffffff").FontSize(9);

                            header.Cell().Background("#1a1a2e").Padding(6)
                                .AlignRight().Text("المجموع").Bold().FontColor("#ffffff").FontSize(9);
                        });

                        // صفوف المنتجات
                        int rowIndex = 1;
                        foreach (var item in subOrder.Items.OrderBy(i => i.ProductName))
                        {
                            var bgColor = rowIndex % 2 == 0 ? "#f9f9f9" : "#ffffff";

                            table.Cell().Background(bgColor).Padding(6)
                                .Text(rowIndex.ToString()).FontSize(9).FontColor("#888888");

                            table.Cell().Background(bgColor).Padding(6).Column(c =>
                            {
                                c.Item().Text(item.ProductNameAr ?? item.ProductName)
                                    .FontSize(10).DirectionFromRightToLeft();

                                if (!string.IsNullOrEmpty(item.ProductName) && item.ProductNameAr != item.ProductName)
                                    c.Item().Text(item.ProductName)
                                        .FontSize(8).FontColor("#888888");

                                if (item.RefusedQuantity > 0)
                                    c.Item().Text($"رُفض عند الاستلام: {item.RefusedQuantity} (- {item.UnitPrice * item.RefusedQuantity:N0})")
                                        .FontSize(8).FontColor("#e74c3c").DirectionFromRightToLeft();

                                if (item.UnavailableQuantity > 0)
                                    c.Item().Text(item.Quantity == 0
                                            ? "غير متوفر — أزاله المتجر ولم يُحتسب"
                                            : $"غير متوفر: {item.UnavailableQuantity} — أُزيل ولم يُحتسب")
                                        .FontSize(8).FontColor("#e67e22").DirectionFromRightToLeft();
                            });

                            table.Cell().Background(bgColor).Padding(6)
                                .AlignRight().Text($"{item.UnitPrice:N0}").FontSize(10);

                            table.Cell().Background(bgColor).Padding(6)
                                .AlignCenter().Text(item.Quantity.ToString()).FontSize(10);

                            table.Cell().Background(bgColor).Padding(6)
                                .AlignRight().Text($"{item.Subtotal:N0}").Bold().FontSize(10);

                            rowIndex++;
                        }
                    });

                    // مجموع المتجر
                    col.Item().AlignRight().Padding(6)
                        .Row(row =>
                        {
                            row.ConstantItem(200).Column(inner =>
                            {
                                inner.Item().Row(r =>
                                {
                                    r.RelativeItem().Text("المجموع الفرعي:")
                                        .FontSize(9).FontColor("#555555").DirectionFromRightToLeft();
                                    r.ConstantItem(80).AlignRight()
                                        .Text($"{subOrder.Subtotal:N0}").FontSize(9);
                                });

                                inner.Item().Row(r =>
                                {
                                    r.RelativeItem().Text("رسوم التوصيل:")
                                        .FontSize(9).FontColor("#555555").DirectionFromRightToLeft();
                                    r.ConstantItem(80).AlignRight()
                                        .Text($"{subOrder.DeliveryFee:N0}").FontSize(9);
                                });
                            });
                        });

                    col.Item().Height(15);
                }

                // ===================================
                // ملخص الإجماليات
                // ===================================
                col.Item().BorderTop(2).BorderColor("#1a1a2e").PaddingTop(10)
                    .AlignRight().Column(summary =>
                    {
                        summary.Item().Row(row =>
                        {
                            row.ConstantItem(220).Column(inner =>
                            {
                                // المجموع الفرعي
                                inner.Item().Padding(3).Row(r =>
                                {
                                    r.RelativeItem().Text("المجموع الفرعي")
                                        .FontSize(10).DirectionFromRightToLeft();
                                    r.ConstantItem(90).AlignRight()
                                        .Text($"{order.Subtotal:N0}").FontSize(10);
                                });

                                // رسوم التوصيل
                                inner.Item().Padding(3).Row(r =>
                                {
                                    r.RelativeItem().Text("رسوم التوصيل")
                                        .FontSize(10).DirectionFromRightToLeft();
                                    r.ConstantItem(90).AlignRight()
                                        .Text($"{order.DeliveryFees:N0}").FontSize(10);
                                });

                                // الخصم (إن وجد): الكوبون والنقاط كلٌّ بسطره
                                var couponDiscount = OrderTotals.CouponDiscount(order);
                                if (couponDiscount > 0)
                                    inner.Item().Padding(3).Row(r =>
                                    {
                                        r.RelativeItem().Text(string.IsNullOrEmpty(order.CouponCode) ? "خصم الكوبون" : $"خصم الكوبون ({order.CouponCode})")
                                            .FontSize(10).FontColor("#e74c3c").DirectionFromRightToLeft();
                                        r.ConstantItem(90).AlignRight()
                                            .Text($"- {couponDiscount:N0}").FontSize(10).FontColor("#e74c3c");
                                    });
                                if (order.PointsDiscountAmount > 0)
                                    inner.Item().Padding(3).Row(r =>
                                    {
                                        r.RelativeItem().Text("خصم النقاط")
                                            .FontSize(10).FontColor("#e74c3c").DirectionFromRightToLeft();
                                        r.ConstantItem(90).AlignRight()
                                            .Text($"- {order.PointsDiscountAmount:N0}").FontSize(10).FontColor("#e74c3c");
                                    });

                                // الفاصل
                                inner.Item().BorderTop(1).BorderColor("#cccccc").Height(1);

                                // الإجمالي
                                inner.Item().Background("#1a1a2e").Padding(8).Row(r =>
                                {
                                    r.RelativeItem().Text("الإجمالي الكلي")
                                        .Bold().FontSize(12).FontColor("#ffffff").DirectionFromRightToLeft();

                                    r.ConstantItem(90).AlignRight()
                                        .Text($"{order.TotalAmount:N0} د.ع")
                                        .Bold().FontSize(12).FontColor("#ffffff");
                                });

                                // الرفض عند الباب: الإجمالي أعلاه = ما دفعه الزبون (بلا المرفوض)؛ هنا للتوضيح فقط، لا يُطرح
                                var refusedAmount = order.SubOrders.SelectMany(so => so.Items).Sum(i => i.UnitPrice * i.RefusedQuantity);
                                if (refusedAmount > 0)
                                {
                                    inner.Item().Padding(3).Row(r =>
                                    {
                                        r.RelativeItem().Text("قطع رُفضت عند الاستلام (غير محتسبة)")
                                            .FontSize(9).FontColor("#888888").DirectionFromRightToLeft();
                                        r.ConstantItem(90).AlignRight()
                                            .Text($"{refusedAmount:N0}").FontSize(9).FontColor("#888888");
                                    });
                                    if (order.SubOrders.Any(so => so.RefusalFeeWaived))
                                        inner.Item().Padding(3).Text("أجرة التوصيل لم تُحتسب عليك بسبب الرفض")
                                            .FontSize(9).FontColor("#888888").DirectionFromRightToLeft();
                                    if (order.OriginalTotalAmount > 0 && order.OriginalTotalAmount != order.TotalAmount)
                                        inner.Item().Padding(3).Row(r =>
                                        {
                                            r.RelativeItem().Text("قيمة الطلب عند الشراء")
                                                .FontSize(9).FontColor("#888888").DirectionFromRightToLeft();
                                            r.ConstantItem(90).AlignRight()
                                                .Text($"{order.OriginalTotalAmount:N0}").FontSize(9).FontColor("#888888");
                                        });
                                }
                                if (failedFee > 0)
                                    inner.Item().Padding(3).Row(r =>
                                    {
                                        r.RelativeItem().Text("أجرة توصيل جزء رُفض استلامه")
                                            .FontSize(10).DirectionFromRightToLeft();
                                        r.ConstantItem(90).AlignRight()
                                            .Text($"+ {failedFee:N0}").FontSize(10);
                                    });
                                if (order.CashCollectedAmount is decimal paid && paid != order.TotalAmount)
                                    inner.Item().Background("#e8f5e9").Padding(6).Row(r =>
                                    {
                                        r.RelativeItem().Text("المبلغ المدفوع")
                                            .Bold().FontSize(11).DirectionFromRightToLeft();
                                        r.ConstantItem(90).AlignRight()
                                            .Text($"{paid:N0} د.ع").Bold().FontSize(11);
                                    });

                                // طريقة الدفع
                                inner.Item().Padding(4).Row(r =>
                                {
                                    r.RelativeItem().Text("طريقة الدفع:")
                                        .FontSize(9).FontColor("#666666").DirectionFromRightToLeft();

                                    r.ConstantItem(90).AlignRight()
                                        .Text(GetPaymentMethodAr(order.PaymentMethod))
                                        .FontSize(9).FontColor("#666666");
                                });
                            });
                        });
                    });

                // ملاحظات الطلب
                if (!string.IsNullOrEmpty(order.CustomerNotes))
                {
                    col.Item().Height(15);
                    col.Item().Border(1).BorderColor("#e0e0e0").Padding(10).Column(c =>
                    {
                        c.Item().Text("ملاحظات").Bold().FontSize(10).DirectionFromRightToLeft();
                        c.Item().Height(4);
                        c.Item().Text(order.CustomerNotes).FontSize(9).FontColor("#555555").DirectionFromRightToLeft();
                    });
                }
            });
        };

        // ===================================
        // Footer — تذييل الفاتورة
        // ===================================
        private static Action<IContainer> ComposeFooter(Order order) => container =>
        {
            container.BorderTop(1).BorderColor("#e0e0e0").PaddingTop(8).Column(col =>
            {
                col.Item().Row(row =>
                {
                    row.RelativeItem()
                        .Text($"تاريخ الإصدار: {IraqTime.FromUtc(DateTime.UtcNow):yyyy/MM/dd HH:mm}")
                        .FontSize(8).FontColor("#999999");

                    row.RelativeItem().AlignRight()
                        .Text($"حالة الطلب: {GetStatusAr(order.Status)}")
                        .FontSize(8).FontColor("#999999");
                });

                col.Item().Height(4);

                col.Item().AlignCenter()
                    .Text("شكراً لتسوقك معنا — هذه الفاتورة صادرة إلكترونياً ولا تحتاج إلى توقيع")
                    .FontSize(8).FontColor("#bbbbbb").DirectionFromRightToLeft();
            });
        };

        // ===================================
        // Helpers
        // ===================================
        private static string GetPaymentMethodAr(string method) => method switch
        {
            PaymentMethods.COD => "الدفع عند الاستلام",
            "card" => "بطاقة ائتمان",
            "wallet" => "محفظة إلكترونية",
            "stcpay" => "STC Pay",
            "mada" => "مدى",
            _ => method
        };

        private static string GetStatusAr(string status) => OrderStatusText.Ar(status);
    }
}
