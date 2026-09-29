using ecommerce.Core.Models;
using ecommerce.Core.DTO.Common;
using ecommerce.Data;
using ecommerce.Extensions;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;

namespace ecommerce.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly AppDbContext _context;

        public UserRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<User> GetByIdAsync(Guid id)
        {
            return await _context.Users
                .FirstOrDefaultAsync(u => u.Id == id);
        }

        public async Task<User> GetByPhoneAsync(string phone)
        {
            return await _context.Users
                .FirstOrDefaultAsync(u => u.Phone == phone);
        }

        public async Task<IEnumerable<User>> GetAllAsync()
        {
            return await _context.Users
                .Where(u => u.IsActive)
                .OrderByDescending(u => u.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<User>> GetByRoleAsync(string role)
        {
            return await _context.Users
                .Where(u => u.Role == role && u.IsActive)
                .OrderByDescending(u => u.CreatedAt)
                .ToListAsync();
        }

        public async Task<User> CreateAsync(User user)
        {
            user.CreatedAt = DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;

            await _context.Users.AddAsync(user);
            await _context.SaveChangesAsync();

            return user;
        }

        public async Task<User> UpdateAsync(User user)
        {
            user.UpdatedAt = DateTime.UtcNow;

            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            return user;
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            var user = await GetByIdAsync(id);
            if (user == null)
                return false;

            // Soft delete
            user.IsActive = false;
            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> ExistsAsync(string phone)
        {
            return await _context.Users
                .AnyAsync(u => u.Phone == phone);
        }


        public async Task<PagedResult<User>> GetPagedAsync(
        string role = null,
        string searchTerm = null,
        bool? isActive = null,
        int pageNumber = 1,
        int pageSize = 20)
        {
            var query = _context.Users
                .AsNoTracking()
                .AsQueryable();

            // فلتر حسب الدور
            if (!string.IsNullOrWhiteSpace(role))
            {
                role = role.Trim().ToUpper();
                query = query.Where(u => u.Role.ToUpper() == role);
            }

            // فلتر البحث
            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                searchTerm = searchTerm.Trim().ToLower();
                query = query.Where(u =>
                    (u.FullName != null && u.FullName.ToLower().Contains(searchTerm)) ||
                    (u.Phone != null && u.Phone.Contains(searchTerm)) ||
                    (u.Email != null && u.Email.ToLower().Contains(searchTerm)));
            }

            // فلتر حسب النشاط
            if (isActive.HasValue)
            {
                query = query.Where(u => u.IsActive == isActive.Value);
            }

            // ترتيب من الأحدث للأقدم
            query = query.OrderByDescending(u => u.CreatedAt);

            // تطبيق Pagination
            return await query.ToPagedListAsync(pageNumber, pageSize);
        }





        public async Task<List<User>> GetPagedAsync(
            Expression<Func<User, bool>>? predicate,
            PaginationParams pagination,
            CancellationToken ct = default)
        {
            var query = _context.Users.AsNoTracking();
            if (predicate != null) query = query.Where(predicate);

            return await query
                .OrderBy(u => u.FullName)
                .ThenBy(u => u.Id)
                .Skip(pagination.Skip)
                .Take(pagination.PageSize)
                .ToListAsync(ct);
        }

        public Task<int> CountAsync(Expression<Func<User, bool>>? predicate = null, CancellationToken ct = default) =>
            predicate == null
                ? _context.Users.CountAsync(ct)
                : _context.Users.CountAsync(predicate, ct);
    }
}
