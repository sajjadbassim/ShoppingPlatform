using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Extensions;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class OrderRepository : IOrderRepository
    {
        private readonly AppDbContext _context;

        public OrderRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Order> GetByIdAsync(Guid id)
        {
            return await _context.Orders
                .Include(o => o.Customer)
                .Include(o => o.Address)
                .Include(o => o.SubOrders)
                    .ThenInclude(so => so.Vendor)
                .Include(o => o.SubOrders)
                    .ThenInclude(so => so.Items)
                        .ThenInclude(i => i.Product)
                .Include(o => o.SubOrders)
                    .ThenInclude(so => so.Items)
                        .ThenInclude(i => i.Variant)
                            .ThenInclude(v => v.AttributeValues)
                                .ThenInclude(av => av.AttributeValue)
                                    .ThenInclude(av => av.Attribute)

                .Include(o => o.SubOrders)
                    .ThenInclude(so => so.ConfirmedByUser)
                .Include(o => o.SubOrders)
                    .ThenInclude(so => so.CancelledByUser)
                .FirstOrDefaultAsync(o => o.Id == id);
        }

        public async Task<Order> GetByOrderNumberAsync(string orderNumber)
        {
            return await _context.Orders
                .Include(o => o.Customer)
                .Include(o => o.Address)
                .Include(o => o.SubOrders)
                    .ThenInclude(so => so.Vendor)
                .Include(o => o.SubOrders)
                    .ThenInclude(so => so.Items)
                .Include(o => o.SubOrders)
                    .ThenInclude(so => so.Driver)   // اسم السائق في صفحة الطلب والتقييم
                .FirstOrDefaultAsync(o => o.OrderNumber == orderNumber);
        }

        public async Task<IEnumerable<Order>> GetByCustomerAsync(Guid customerId)
        {
            return await _context.Orders
                .Include(o => o.Address)
                .Include(o => o.SubOrders)
                    .ThenInclude(so => so.Vendor)
                .Where(o => o.CustomerId == customerId)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();
        }

        public async Task<Order> CreateAsync(Order order)
        {
            order.CreatedAt = DateTime.UtcNow;
            order.UpdatedAt = DateTime.UtcNow;

            await _context.Orders.AddAsync(order);
            await _context.SaveChangesAsync();

            return await GetByIdAsync(order.Id);
        }

        public async Task<Order> UpdateAsync(Order order)
        {
            order.UpdatedAt = DateTime.UtcNow;

            _context.Orders.Update(order);
            await _context.SaveChangesAsync();

            return await GetByIdAsync(order.Id);
        }

        public async Task<string> GenerateOrderNumberAsync()
        {
            var today = DateTime.UtcNow;
            var datePrefix = today.ToString("yyyyMMdd");

            // البحث عن آخر رقم طلب اليوم
            var lastOrder = await _context.Orders
                .Where(o => o.OrderNumber.StartsWith($"ORD-{datePrefix}"))
                .OrderByDescending(o => o.OrderNumber)
                .FirstOrDefaultAsync();

            int sequence = 1;
            if (lastOrder != null)
            {
                // استخراج الرقم التسلسلي
                var parts = lastOrder.OrderNumber.Split('-');
                if (parts.Length == 3 && int.TryParse(parts[2], out int lastSequence))
                {
                    sequence = lastSequence + 1;
                }
            }

            return $"ORD-{datePrefix}-{sequence:D4}";
        }

        public async Task<PagedResult<Order>> GetPagedAsync(
        Guid? customerId,
        string orderNumber,
        string status,
        int pageNumber,
        int pageSize)
        {
            // القائمة تعرض الزبون والعنوان والمتاجر والسائق وصور المنتجات — بدونها تظهر البطاقات فارغة
            var query = _context.Orders
                .AsNoTracking()
                .Include(o => o.Customer)
                .Include(o => o.Address)
                .Include(o => o.SubOrders).ThenInclude(so => so.Vendor)
                .Include(o => o.SubOrders).ThenInclude(so => so.Driver)
                .Include(o => o.SubOrders).ThenInclude(so => so.Items)
                .AsSplitQuery()
                .AsQueryable();

            // فلترة حسب العميل
            if (customerId.HasValue)
                query = query.Where(o => o.CustomerId == customerId);

            // البحث: رقم الطلب أو اسم الزبون أو هاتفه
            if (!string.IsNullOrWhiteSpace(orderNumber))
            {
                var term = orderNumber.Trim();
                query = query.Where(o => o.OrderNumber.Contains(term)
                    || (o.Customer != null && (o.Customer.FullName.Contains(term) || o.Customer.Phone.Contains(term))));
            }

            // فلترة حسب الحالة
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(o => o.Status == status);

            query = query.OrderByDescending(o => o.CreatedAt);

            return await query.ToPagedListAsync(pageNumber, pageSize);
        }


    
        // عدد الطلبات لكل حالة — لأزرار التصفية في شاشة العمليات
        public async Task<Dictionary<string, int>> GetStatusCountsAsync() =>
            await _context.Orders
                .AsNoTracking()
                .GroupBy(o => o.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Status, x => x.Count);
    }
}
