using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Admin;
using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Product;
using ecommerce.Core.DTO.Users;
using ecommerce.Core.DTO.Vendor;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;
using ecommerce.Core.Exceptions;
using ecommerce.Services.FinanceService;

namespace ecommerce.Services.AdminService
{
    public class AdminService : IAdminService
    {
        private readonly AppDbContext _context;
        private readonly IUserRepository _userRepository;
        private readonly IVendorRepository _vendorRepository;
        private readonly IProductRepository _productRepository;
        private readonly ecommerce.Services.VendorService.VendorService.IVendorService? _vendorService;

        public AdminService(
            AppDbContext context,
            IUserRepository userRepository,
            IVendorRepository vendorRepository,
            IProductRepository productRepository,
            ecommerce.Services.VendorService.VendorService.IVendorService? vendorService = null)
        {
            _vendorService = vendorService;
            _context = context;
            _userRepository = userRepository;
            _vendorRepository = vendorRepository;
            _productRepository = productRepository;
        }

        public async Task<DashboardStatsDto> GetDashboardStatsAsync()
        {
            // «اليوم» و«الشهر» بتوقيت بغداد (طلبات منتصف الليل حتى الثالثة كانت تُحسب لليوم السابق)
            var today = IraqTime.TodayStartUtc;
            var monthStart = IraqTime.MonthStartUtc;

            var stats = new DashboardStatsDto
            {
                // Users
                TotalUsers = await _context.Users.CountAsync(),
                TotalCustomers = await _context.Users.CountAsync(u => u.Role == UserRoles.Customer),
                TotalOps = await _context.Users.CountAsync(u => u.Role == UserRoles.Ops),
                ActiveUsers = await _context.Users.CountAsync(u => u.IsActive),
                NewUsersToday = await _context.Users.CountAsync(u => u.CreatedAt >= today),

                // Vendors
                TotalVendors = await _context.Vendors.CountAsync(),
                ActiveVendors = await _context.Vendors.CountAsync(v => v.IsActive),
                InactiveVendors = await _context.Vendors.CountAsync(v => !v.IsActive),

                // Products
                TotalProducts = await _context.Products.CountAsync(p => !p.IsDeleted),
                ActiveProducts = await _context.Products.CountAsync(p => p.IsActive && p.IsAvailable),
                OutOfStock = await _context.Products.CountAsync(p => !p.IsDeleted && p.StockQuantity == 0),

                // Orders
                TotalOrders = await _context.Orders.CountAsync(),
                PendingOrders = await _context.Orders.CountAsync(o => o.Status == OrderStatus.PENDING_CONFIRMATION),
                // «مؤكدة» = قيد التنفيذ (قبلها متجر ولم تُسلَّم بعد)
                ConfirmedOrders = await _context.Orders.CountAsync(o => InProgress.Contains(o.Status)),
                DeliveredOrders = await _context.Orders.CountAsync(o => o.Status == OrderStatus.DELIVERED),
                CancelledOrders = await _context.Orders.CountAsync(o => o.Status == OrderStatus.CANCELLED),
                TodayOrders = await _context.Orders.CountAsync(o => o.CreatedAt >= today),

                // الإيراد = مبيعات ما سُلّم فعلاً (دفتر المتاجر: بلا المرفوض عند الباب، ناقص المُرجَع) — نفس أرقام المالية
                TotalRevenue = await SalesEntries().SumAsync(e => (decimal?)e.Amount) ?? 0,
                TodayRevenue = await SalesEntries().Where(e => e.CreatedAt >= today).SumAsync(e => (decimal?)e.Amount) ?? 0,
                MonthRevenue = await SalesEntries().Where(e => e.CreatedAt >= monthStart).SumAsync(e => (decimal?)e.Amount) ?? 0,
                // قيمة الطلبات التي لم تُسلَّم بعد (لا تُحسب إيراداً)
                InProgressValue = await _context.Orders.Where(o => InProgress.Contains(o.Status) || o.Status == OrderStatus.PENDING_CONFIRMATION)
                    .SumAsync(o => (decimal?)o.TotalAmount) ?? 0,

                // SubOrders
                PendingSubOrders = await _context.SubOrders
                    .CountAsync(so => so.Status == SubOrderStatus.PendingConfirmation),
                ExpiredSubOrders = await _context.SubOrders
                    .CountAsync(so => so.Status == SubOrderStatus.PendingConfirmation
                        && so.ConfirmationDeadline < DateTime.UtcNow)
            };

            return stats;
        }

        public async Task<Common.PagedResponse<UserSearchResponseDto>> SearchUsersAsync(
            string? term, string? role, PaginationParams pagination, CancellationToken ct = default)
        {
            var t = string.IsNullOrWhiteSpace(term) ? null : term.Trim();
            var r = string.IsNullOrWhiteSpace(role) ? null : role;

            Expression<Func<User, bool>> predicate = u =>
                (r == null || u.Role == r) &&
                (t == null ||
                 u.FullName.Contains(t) ||
                 u.Phone.Contains(t) ||
                 (u.Email != null && u.Email.Contains(t)));

            var totalCount = await _userRepository.CountAsync(predicate, ct);
            var users = await _userRepository.GetPagedAsync(predicate, pagination, ct);

            return new Common.PagedResponse<UserSearchResponseDto>
            {
                Data = users.Select(u => new UserSearchResponseDto
                {
                    Id = u.Id,
                    Phone = u.Phone,
                    FullName = u.FullName,
                    Email = u.Email,
                    Role = u.Role,
                    IsActive = u.IsActive
                }).ToList(),
                TotalCount = totalCount,
                PageNumber = pagination.PageNumber,
                PageSize = pagination.PageSize
            };
        }

        public async Task<IEnumerable<UserManagementDto>> GetAllUsersAsync(string role = null)
        {
            var query = _context.Users.AsQueryable();

            if (!string.IsNullOrEmpty(role))
            {
                query = query.Where(u => u.Role == role);
            }

            var users = await query
                .OrderByDescending(u => u.CreatedAt)
                .ToListAsync();

            var usersDto = new List<UserManagementDto>();

            foreach (var user in users)
            {
                var orderStats = await _context.Orders
                    .Where(o => o.CustomerId == user.Id)
                    .GroupBy(o => o.CustomerId)
                    .Select(g => new
                    {
                        TotalOrders = g.Count(),
                        TotalSpent = g.Sum(o => o.TotalAmount)
                    })
                    .FirstOrDefaultAsync();

                usersDto.Add(new UserManagementDto
                {
                    Id = user.Id,
                    Phone = user.Phone,
                    FullName = user.FullName,
                    Email = user.Email,
                    Role = user.Role,
                    IsActive = user.IsActive,
                    LastLogin = user.LastLogin,
                    CreatedAt = user.CreatedAt,
                    TotalOrders = orderStats?.TotalOrders ?? 0,
                    TotalSpent = orderStats?.TotalSpent ?? 0
                });
            }

            return usersDto;
        }

        public async Task<UserResponseDto> CreateOpsUserAsync(CreateOpsUserDto dto)
        {
            // التحقق من عدم وجود المستخدم
            var phone = PhoneNumber.Require(dto.Phone);
            if (await _userRepository.ExistsAsync(phone))
                throw new BusinessRuleException("رقم الهاتف مسجل مسبقاً");
            var opsEmail = EmailAddress.Normalize(dto.Email);
            if (opsEmail.Length > 0 && await _userRepository.GetByEmailAsync(opsEmail) != null)
                throw new BusinessRuleException("البريد الإلكتروني مستخدم لحساب آخر");
            dto.Email = opsEmail;

            var user = new User
            {
                Phone = phone,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                FullName = dto.FullName,
                Email = dto.Email,
                Role = UserRoles.Ops,
                IsActive = true
            };

            user = await _userRepository.CreateAsync(user);

            return new UserResponseDto
            {
                Id = user.Id,
                Phone = user.Phone,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                IsActive = user.IsActive,
                CreatedAt = user.CreatedAt
            };
        }

        public async Task<bool> ToggleUserStatusAsync(Guid userId, Guid actingUserId)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
                throw new NotFoundException("المستخدم غير موجود");
            if (user.IsActive) await AdminAccountGuard.EnsureCanDisableAsync(_userRepository, user, actingUserId);

            user.IsActive = !user.IsActive;
            await _userRepository.UpdateAsync(user);

            return user.IsActive;
        }

        public async Task<bool> DeleteUserAsync(Guid userId, Guid actingUserId)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null) return false;
            if (user.IsActive) await AdminAccountGuard.EnsureCanDisableAsync(_userRepository, user, actingUserId);
            return await _userRepository.DeleteAsync(userId);
        }

        public async Task<IEnumerable<VendorResponseDto>> GetAllVendorsAsync(bool? isActive = null)
        {
            var query = _context.Vendors.AsQueryable();

            if (isActive.HasValue)
            {
                query = query.Where(v => v.IsActive == isActive.Value);
            }

            var vendors = await query
                .OrderByDescending(v => v.CreatedAt)
                .ToListAsync();

            return vendors.Select(v => new VendorResponseDto
            {
                Id = v.Id,
                Name = v.Name,
                NameAr = v.NameAr,
                Description = v.Description,
                LogoUrl = v.LogoUrl,
                Phone = v.Phone,
                Address = v.Address,
                IsActive = v.IsActive,
                MinOrderAmount = v.MinOrderAmount,
                DeliveryFee = v.DeliveryFee,
                EstimatedPrepTime = v.EstimatedPrepTime,
                CreatedAt = v.CreatedAt
            });
        }

        public async Task<(bool IsActive, bool OwnerUpgraded)> ToggleVendorStatusAsync(Guid vendorId)
        {
            var vendor = await _vendorRepository.GetByIdAsync(vendorId);
            if (vendor == null)
                throw new NotFoundException("المتجر غير موجود");

            vendor.IsActive = !vendor.IsActive;
            await _vendorRepository.UpdateAsync(vendor);

            // التفعيل يحوّل صاحب المتجر لبائع في نفس العملية (كان يتم من المتصفح بطلب منفصل)
            var upgraded = vendor.IsActive && _vendorService != null && await _vendorService.ApproveOwnerAsync(vendor.Id);
            return (vendor.IsActive, upgraded);
        }

        public async Task<IEnumerable<ProductDto>> GetAllProductsAsync(bool? isActive = null)
        {
            var query = _context.Products
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Where(p => !p.IsDeleted)
                .AsQueryable();

            if (isActive.HasValue)
            {
                query = query.Where(p => p.IsActive == isActive.Value);
            }

            var products = await query
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            return products.Select(p => new ProductDto
            {
                Id = p.Id,
                Name = p.Name,
                NameAr = p.NameAr,
                Description = p.Description,
                Price = p.Price,
                OriginalPrice = p.OriginalPrice,
                Sku = p.Sku,
                StockQuantity = p.StockQuantity,
                IsAvailable = p.IsAvailable,
                IsActive = p.IsActive,
                VendorId = p.VendorId,
                VendorName = p.Vendor?.Name,
                CategoryId = p.CategoryId,
                CategoryName = p.Category?.Name,
                CreatedAt = p.CreatedAt
            });
        }

        public async Task<bool> ToggleProductStatusAsync(Guid productId)
        {
            var product = await _productRepository.GetByIdAsync(productId);
            if (product == null)
                throw new NotFoundException("المنتج غير موجود");

            product.IsActive = !product.IsActive;
            await _productRepository.UpdateAsync(product);

            return product.IsActive;
        }

        public async Task<bool> BulkUpdateProductsStatusAsync(List<Guid> productIds, bool isActive)
        {
            var products = await _context.Products
                .Where(p => productIds.Contains(p.Id))
                .ToListAsync();

            foreach (var product in products)
            {
                product.IsActive = isActive;
            }

            await _context.SaveChangesAsync();
            return true;
        }
        private static readonly string[] InProgress =
        {
            OrderStatus.CONFIRMED, OrderStatus.PARTIALLY_CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY,
        };

        // قيود المبيعات في دفتر المتاجر: بيع ما سُلّم (+) وما أُرجع بعده (−)
        private IQueryable<VendorLedgerEntry> SalesEntries() => _context.VendorLedgerEntries
            .Where(e => e.Type == LedgerType.Sale || e.Type == LedgerType.Return);

        public async Task<object> GetSalesReportAsync(DateTime startDate, DateTime endDate)
        {
            // التاريخان أيام بتوقيت بغداد: من بداية يوم البداية حتى نهاية يوم النهاية، والتجميع بيوم بغداد
            var fromUtc = IraqTime.DayStartUtc(startDate);
            var toUtc = IraqTime.DayStartUtc(endDate).AddDays(1);
            var offsetHours = (int)IraqTime.Offset.TotalHours;

            var orders = await _context.Orders
                .Where(o => o.CreatedAt >= fromUtc && o.CreatedAt < toUtc)
                .GroupBy(o => o.CreatedAt.AddHours(offsetHours).Date)
                .Select(g => new
                {
                    Date = g.Key,
                    TotalOrders = g.Count(),
                    ConfirmedOrders = g.Count(o => InProgress.Contains(o.Status)),
                    DeliveredOrders = g.Count(o => o.Status == OrderStatus.DELIVERED),
                    CancelledOrders = g.Count(o => o.Status == OrderStatus.CANCELLED)
                })
                .ToListAsync();

            // الإيراد بيوم التسليم (لا يوم الطلب) ومن ما سُلّم فعلاً
            var revenue = await SalesEntries()
                .Where(e => e.CreatedAt >= fromUtc && e.CreatedAt < toUtc)
                .GroupBy(e => e.CreatedAt.AddHours(offsetHours).Date)
                .Select(g => new { Date = g.Key, Revenue = g.Sum(e => e.Amount) })
                .ToListAsync();

            var daily = orders.Select(o => o.Date).Union(revenue.Select(r => r.Date)).OrderBy(d => d)
                .Select(d =>
                {
                    var o = orders.FirstOrDefault(x => x.Date == d);
                    return new
                    {
                        Date = d,
                        TotalOrders = o?.TotalOrders ?? 0,
                        TotalRevenue = revenue.FirstOrDefault(r => r.Date == d)?.Revenue ?? 0,
                        ConfirmedOrders = o?.ConfirmedOrders ?? 0,
                        DeliveredOrders = o?.DeliveredOrders ?? 0,
                        CancelledOrders = o?.CancelledOrders ?? 0,
                    };
                })
                .ToList();

            return new
            {
                startDate,
                endDate,
                totalOrders = daily.Sum(x => x.TotalOrders),
                totalRevenue = daily.Sum(x => x.TotalRevenue),
                dailyStats = daily
            };
        }
        public async Task<object> GetTopVendorsAsync(int count = 10)
        {
            // مبيعات كل متجر مما سُلّم (بلا التوصيل ولا المرفوض، ناقص المُرجَع)
            var sales = await SalesEntries()
                .GroupBy(e => e.VendorId)
                .Select(g => new
                {
                    VendorId = g.Key,
                    TotalOrders = g.Where(e => e.Type == LedgerType.Sale).Select(e => e.SubOrderId).Distinct().Count(),
                    TotalRevenue = g.Sum(e => e.Amount)
                })
                .OrderByDescending(x => x.TotalRevenue)
                .Take(count)
                .ToListAsync();

            var ids = sales.Select(s => s.VendorId).ToList();
            var names = await _context.Vendors.Where(v => ids.Contains(v.Id)).ToDictionaryAsync(v => v.Id, v => v.Name);
            return sales.Select(s => new
            {
                s.VendorId,
                VendorName = names.GetValueOrDefault(s.VendorId),
                s.TotalOrders,
                s.TotalRevenue
            }).ToList();
        }

        public async Task<object> GetTopProductsAsync(int count = 10)
        {
            // القطع التي وصلت الزبون فعلاً: من متاجر سُلّمت، بلا المرفوض عند الباب، ناقص ما أُرجع بعد الاستلام
            var sold = await _context.SubOrderItems
                .Where(i => i.SubOrder.Status == OrderStatus.DELIVERED)
                .GroupBy(i => new { i.ProductId, i.ProductName })
                .Select(g => new
                {
                    g.Key.ProductId,
                    g.Key.ProductName,
                    Quantity = g.Sum(i => i.Quantity - i.RefusedQuantity),
                    Revenue = g.Sum(i => i.UnitPrice * (i.Quantity - i.RefusedQuantity))
                })
                .ToListAsync();

            var returned = await _context.ReturnItems
                .Where(ri => !ri.Return.IsDoorRefusal && (ri.Return.Status == ReturnStatus.APPROVED || ri.Return.Status == ReturnStatus.COMPLETED))
                .GroupBy(ri => ri.ProductId)
                .Select(g => new { ProductId = g.Key, Quantity = g.Sum(ri => ri.Quantity), Value = g.Sum(ri => ri.UnitPrice * ri.Quantity) })
                .ToDictionaryAsync(x => x.ProductId);

            return sold
                .Select(p =>
                {
                    var r = returned.GetValueOrDefault(p.ProductId);
                    return new
                    {
                        p.ProductId,
                        p.ProductName,
                        TotalQuantity = p.Quantity - (r?.Quantity ?? 0),
                        TotalRevenue = p.Revenue - (r?.Value ?? 0)
                    };
                })
                .Where(p => p.TotalQuantity > 0)
                .OrderByDescending(x => x.TotalQuantity)
                .Take(count)
                .ToList();
        }

        public async Task<string> ChangeUserRoleAsync(Guid userId, string newRole)
        {
            var allowedRoles = new[] { UserRoles.Customer, UserRoles.Vendor, UserRoles.Ops };
            if (!allowedRoles.Contains(newRole))
                throw new BusinessRuleException($"الدور غير صالح. الأدوار المسموحة: {string.Join(", ", allowedRoles)}");

            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
                throw new NotFoundException("المستخدم غير موجود");

            if (user.Role == UserRoles.Admin)
                throw new BusinessRuleException("لا يمكن تغيير دور Admin");

            var oldRole = user.Role;
            user.Role = newRole;
            await _userRepository.UpdateAsync(user);

            return $"تم تغيير دور المستخدم من {oldRole} إلى {newRole}";
        }

    }





}
