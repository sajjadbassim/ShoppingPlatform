using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services;
using ecommerce.Services.FinanceService;
using ecommerce.Services.InventoryService;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace ecommerce.Tests.Services
{
    // لوحة التاجر: المتغير في الطلب، البحث والأعداد من الخادم، المخزون مع المتغيرات، الأكثر مبيعاً والمبيعات من الدفتر
    public class VendorDashboardFixesTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly Vendor _store;
        private readonly User _customer;
        private readonly Address _address;
        private readonly Order _order;

        public VendorDashboardFixesTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
            _store = new Vendor { Name = "s", NameAr = "s", OwnerId = Guid.NewGuid(), IsActive = true };
            _customer = new User { Phone = "07701112233", FullName = "علي حسن", Role = UserRoles.Customer, PasswordHash = "x" };
            _address = new Address { UserId = _customer.Id, StreetAddress = "1", City = "بغداد", Phone = "0770" };
            _order = new Order { OrderNumber = "ORD-20261006-0001", CustomerId = _customer.Id, AddressId = _address.Id };
            _context.AddRange(_store, _customer, _address, _order);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private VendorDashboardService Service() => new(_context, new Mock<IInventoryService>().Object);

        private Product AddProduct(string name, decimal price, int stock = 5)
        {
            var p = new Product { VendorId = _store.Id, Name = name, NameAr = name, Price = price, StockQuantity = stock, IsActive = true, IsAvailable = true };
            _context.Products.Add(p);
            return p;
        }

        private SubOrder AddSubOrder(string status, string number = "ORD-1-V1", Order? order = null)
        {
            var so = new SubOrder { OrderId = (order ?? _order).Id, VendorId = _store.Id, SubOrderNumber = number, Status = status, Subtotal = 10000, DeliveryFee = 2000 };
            _context.SubOrders.Add(so);
            return so;
        }

        [Fact]
        public async Task OrderItems_ShowChosenVariant()
        {
            var shirt = AddProduct("قميص", 10000);
            var size = new ProductAttribute { ProductId = shirt.Id, Name = "Size", NameAr = "المقاس", DisplayOrder = 0 };
            var color = new ProductAttribute { ProductId = shirt.Id, Name = "Color", NameAr = "اللون", DisplayOrder = 1 };
            var large = new ProductAttributeValue { AttributeId = size.Id, Value = "L" };
            var red = new ProductAttributeValue { AttributeId = color.Id, Value = "Red", ValueAr = "أحمر" };
            var variant = new ProductVariant { ProductId = shirt.Id, Sku = "SH-L-R", StockQuantity = 3 };
            var so = AddSubOrder(SubOrderStatus.PendingConfirmation);
            _context.AddRange(size, color, large, red, variant,
                new ProductVariantAttributeValue { VariantId = variant.Id, AttributeValueId = red.Id },
                new ProductVariantAttributeValue { VariantId = variant.Id, AttributeValueId = large.Id },
                new SubOrderItem { SubOrderId = so.Id, ProductId = shirt.Id, VariantId = variant.Id, ProductName = "قميص", Quantity = 1, UnitPrice = 10000, Subtotal = 10000 });
            await _context.SaveChangesAsync();

            var item = Assert.Single((await Service().GetOrderByIdAsync(_store.Id, so.Id)).Items);

            Assert.Equal("المقاس: L · اللون: أحمر", item.VariantLabel);
            Assert.Equal("SH-L-R", item.VariantSku);
        }

        [Fact]
        public async Task Search_FindsOrdersBeyondTheCurrentPage()
        {
            var other = new User { Phone = "07809998877", FullName = "زبون آخر", Role = UserRoles.Customer, PasswordHash = "x" };
            var otherOrder = new Order { OrderNumber = "ORD-20261006-0002", CustomerId = other.Id, AddressId = _address.Id };
            _context.AddRange(other, otherOrder);
            AddSubOrder(SubOrderStatus.Delivered, "ORD-20261006-0001-V1");
            for (var i = 0; i < 20; i++) AddSubOrder(SubOrderStatus.Delivered, $"ORD-20261006-0002-V{i}", otherOrder);
            await _context.SaveChangesAsync();

            var byPhone = await Service().GetOrdersAsync(_store.Id, pageSize: 5, search: "1112233");
            var byName = await Service().GetOrdersAsync(_store.Id, pageSize: 5, search: "علي");

            Assert.Equal("ORD-20261006-0001-V1", Assert.Single(byPhone.Data).SubOrderNumber);
            Assert.Single(byName.Data);
        }

        [Fact]
        public async Task OrderCounts_ComeFromServer()
        {
            AddSubOrder(SubOrderStatus.PendingConfirmation, "A");
            AddSubOrder(SubOrderStatus.PendingConfirmation, "B");
            AddSubOrder(SubOrderStatus.Delivered, "C");
            await _context.SaveChangesAsync();

            var counts = await Service().GetOrderCountsAsync(_store.Id);

            Assert.Equal(3, counts.Total);
            Assert.Equal(2, counts.ByStatus[SubOrderStatus.PendingConfirmation]);
            Assert.Equal(20000, counts.PendingValue);   // 2 × 10000 — أجرة التوصيل ليست للمتجر
        }

        [Fact]
        public async Task StockAlerts_CountVariantStock()
        {
            // المنتج ذو المتغيرات مخزونه العام 0 لكن متغيراته متوفرة — ليس «نافداً»
            var withVariants = AddProduct("بمتغيرات", 100, stock: 0);
            _context.ProductVariants.AddRange(
                new ProductVariant { ProductId = withVariants.Id, Sku = "a", StockQuantity = 20, IsAvailable = true },
                new ProductVariant { ProductId = withVariants.Id, Sku = "b", StockQuantity = 9, IsAvailable = false });
            var soldOutVariants = AddProduct("متغيرات نفدت", 100, stock: 0);
            _context.ProductVariants.Add(new ProductVariant { ProductId = soldOutVariants.Id, Sku = "c", StockQuantity = 0, IsAvailable = true });
            AddProduct("عادي قليل", 100, stock: 3);
            await _context.SaveChangesAsync();

            var d = await Service().GetDashboardAsync(_store.Id);

            Assert.Equal(1, d.OutOfStockProducts);   // «متغيرات نفدت» فقط
            Assert.Equal(1, d.LowStockProducts);     // «عادي قليل»
            Assert.Equal(2, d.ActiveProducts);
        }

        [Fact]
        public async Task TopProducts_GroupedByProduct_ExcludingRefusedPieces()
        {
            var shirt = AddProduct("قميص", 12000);
            var so = AddSubOrder(SubOrderStatus.Delivered);
            _context.SubOrderItems.AddRange(
                new SubOrderItem { SubOrderId = so.Id, ProductId = shirt.Id, ProductName = "قميص", Quantity = 2, UnitPrice = 10000, Subtotal = 20000 },
                // نفس المنتج بسعر عرض مختلف، وقطعة رفضها الزبون عند الباب
                new SubOrderItem { SubOrderId = so.Id, ProductId = shirt.Id, ProductName = "قميص", Quantity = 3, RefusedQuantity = 1, UnitPrice = 8000, Subtotal = 24000 });
            await _context.SaveChangesAsync();

            var top = Assert.Single((await Service().GetDashboardAsync(_store.Id)).TopProducts);

            Assert.Equal(4, top.TotalSold);              // 2 + (3 − 1)
            Assert.Equal(36000, top.TotalRevenue);       // 20000 + 2 × 8000
            Assert.Equal(12000, top.Price);              // السعر الحالي
        }

        [Fact]
        public async Task Revenue_ComesFromLedger_ByActualDate()
        {
            var so = AddSubOrder(SubOrderStatus.Delivered);
            _context.VendorLedgerEntries.AddRange(
                new VendorLedgerEntry { VendorId = _store.Id, Type = LedgerType.Sale, Amount = 30000, SubOrderId = so.Id, CreatedAt = DateTime.UtcNow },
                new VendorLedgerEntry { VendorId = _store.Id, Type = LedgerType.Return, Amount = -5000, SubOrderId = so.Id, CreatedAt = DateTime.UtcNow },
                new VendorLedgerEntry { VendorId = _store.Id, Type = LedgerType.Commission, Amount = -3000, SubOrderId = so.Id, CreatedAt = DateTime.UtcNow },
                new VendorLedgerEntry { VendorId = _store.Id, Type = LedgerType.Sale, Amount = 40000, SubOrderId = Guid.NewGuid(), CreatedAt = DateTime.UtcNow.AddDays(-40) });
            await _context.SaveChangesAsync();

            var d = await Service().GetDashboardAsync(_store.Id);
            var week = await Service().GetSalesStatsAsync(_store.Id, "week");

            Assert.Equal(25000, d.RevenueToday);      // البيع − المرتجع (العمولة ليست من المبيعات)
            Assert.Equal(25000, d.RevenueThisMonth);
            Assert.Equal(65000, d.TotalRevenue);
            Assert.Equal(25000, week.TotalRevenue);
            Assert.Equal(1, week.TotalOrders);
            Assert.Equal(25000, week.SalesByDay.Last().Revenue);
        }
    }
}
