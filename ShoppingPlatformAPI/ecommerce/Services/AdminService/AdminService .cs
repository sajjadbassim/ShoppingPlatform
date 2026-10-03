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
            var today = DateTime.UtcNow.Date;
            var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);

            var stats = new DashboardStatsDto
            {
                // Users
                TotalUsers = await _context.Users.CountAsync(),
                TotalCustomers = await _context.Users.CountAsync(u => u.Role == UserRoles.Customer),
                TotalOps = await _context.Users.CountAsync(u => u.Role == UserRoles.Ops),
                ActiveUsers = await _context.Users.CountAsync(u => u.IsActive),
                NewUsersToday = await _context.Users.CountAsync(u => u.CreatedAt.Date == today),

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
                ConfirmedOrders = await _context.Orders.CountAsync(o => o.Status == OrderStatus.CONFIRMED),
                CancelledOrders = await _context.Orders.CountAsync(o => o.Status == OrderStatus.CANCELLED),
                TodayOrders = await _context.Orders.CountAsync(o => o.CreatedAt.Date == today),

                // Revenue
                TotalRevenue = await _context.Orders
                    .Where(o => o.Status != OrderStatus.CANCELLED)
                    .SumAsync(o => o.TotalAmount),
                TodayRevenue = await _context.Orders
                    .Where(o => o.CreatedAt.Date == today && o.Status != OrderStatus.CANCELLED)
                    .SumAsync(o => o.TotalAmount),
                MonthRevenue = await _context.Orders
                    .Where(o => o.CreatedAt >= monthStart && o.Status != OrderStatus.CANCELLED)
                    .SumAsync(o => o.TotalAmount),

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
                throw new Exception("رقم الهاتف مسجل مسبقاً");
            var opsEmail = EmailAddress.Normalize(dto.Email);
            if (opsEmail.Length > 0 && await _userRepository.GetByEmailAsync(opsEmail) != null)
                throw new Exception("البريد الإلكتروني مستخدم لحساب آخر");
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

        public async Task<bool> ToggleUserStatusAsync(Guid userId)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
                throw new Exception("المستخدم غير موجود");

            user.IsActive = !user.IsActive;
            await _userRepository.UpdateAsync(user);

            return user.IsActive;
        }

        public async Task<bool> DeleteUserAsync(Guid userId)
        {
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
                throw new Exception("المتجر غير موجود");

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
                throw new Exception("المنتج غير موجود");

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
        public async Task<object> GetSalesReportAsync(DateTime startDate, DateTime endDate)
        {
            // ✅ تأكد أن endDate يغطي نهاية اليوم كاملاً
            endDate = endDate.Date.AddDays(1).AddSeconds(-1);

            var orders = await _context.Orders
                .Where(o => o.CreatedAt >= startDate && o.CreatedAt <= endDate)
                .GroupBy(o => o.CreatedAt.Date)
                .Select(g => new
                {
                    Date = g.Key,
                    TotalOrders = g.Count(),
                    TotalRevenue = g.Sum(o => o.TotalAmount),
                    ConfirmedOrders = g.Count(o => o.Status == OrderStatus.CONFIRMED),
                    CancelledOrders = g.Count(o => o.Status == OrderStatus.CANCELLED)
                })
                .OrderBy(x => x.Date)
                .ToListAsync();

            return new
            {
                startDate,
                endDate,
                totalOrders = orders.Sum(x => x.TotalOrders),
                totalRevenue = orders.Sum(x => x.TotalRevenue),
                dailyStats = orders
            };
        }
        public async Task<object> GetTopVendorsAsync(int count = 10)
        {
            var topVendors = await _context.SubOrders
                .Where(so => so.Status == SubOrderStatus.Confirmed || so.Status == SubOrderStatus.Delivered)
                .GroupBy(so => new { so.VendorId, so.Vendor.Name })
                .Select(g => new
                {
                    VendorId = g.Key.VendorId,
                    VendorName = g.Key.Name,
                    TotalOrders = g.Count(),
                    TotalRevenue = g.Sum(so => so.Subtotal + so.DeliveryFee)
                })
                .OrderByDescending(x => x.TotalRevenue)
                .Take(count)
                .ToListAsync();

            return topVendors;
        }

        public async Task<object> GetTopProductsAsync(int count = 10)
        {
            var topProducts = await _context.SubOrderItems
                .GroupBy(i => new { i.ProductId, i.ProductName })
                .Select(g => new
                {
                    ProductId = g.Key.ProductId,
                    ProductName = g.Key.ProductName,
                    TotalQuantity = g.Sum(i => i.Quantity),
                    TotalRevenue = g.Sum(i => i.Subtotal)
                })
                .OrderByDescending(x => x.TotalQuantity)
                .Take(count)
                .ToListAsync();

            return topProducts;
        }

        public async Task<string> ChangeUserRoleAsync(Guid userId, string newRole)
        {
            var allowedRoles = new[] { UserRoles.Customer, UserRoles.Vendor, UserRoles.Ops };
            if (!allowedRoles.Contains(newRole))
                throw new Exception($"الدور غير صالح. الأدوار المسموحة: {string.Join(", ", allowedRoles)}");

            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
                throw new Exception("المستخدم غير موجود");

            if (user.Role == UserRoles.Admin)
                throw new Exception("لا يمكن تغيير دور Admin");

            var oldRole = user.Role;
            user.Role = newRole;
            await _userRepository.UpdateAsync(user);

            return $"تم تغيير دور المستخدم من {oldRole} إلى {newRole}";
        }

    }





}
