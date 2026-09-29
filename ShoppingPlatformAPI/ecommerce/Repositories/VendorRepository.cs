using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Extensions;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ecommerce.Repositories
{
    public class VendorRepository : IVendorRepository
    {
        private readonly AppDbContext _context;

        public VendorRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Vendor> GetByIdAsync(Guid id)
        {
            return await _context.Vendors
                .FirstOrDefaultAsync(v => v.Id == id);
        }

        public async Task<Vendor> GetByNameAsync(string name)
        {
            return await _context.Vendors
                .FirstOrDefaultAsync(v => v.Name == name);
        }

        public async Task<IEnumerable<Vendor>> GetAllAsync(bool onlyActive = true)
        {
            var query = _context.Vendors.AsQueryable();

            if (onlyActive)
                query = query.Where(v => v.IsActive);

            return await query
                .OrderByDescending(v => v.CreatedAt)
                .ToListAsync();
        }

        public async Task<Vendor> CreateAsync(Vendor vendor)
        {
            vendor.CreatedAt = DateTime.UtcNow;
            vendor.UpdatedAt = DateTime.UtcNow;

            await _context.Vendors.AddAsync(vendor);
            await _context.SaveChangesAsync();

            return vendor;
        }

        public async Task<Vendor> UpdateAsync(Vendor vendor)
        {
            vendor.UpdatedAt = DateTime.UtcNow;

            _context.Vendors.Update(vendor);
            await _context.SaveChangesAsync();

            return vendor;
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            var vendor = await GetByIdAsync(id);
            if (vendor == null)
                return false;

            // Soft delete (أفضل من الحذف النهائي)
            vendor.IsActive = false;
            vendor.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> ExistsAsync(Guid id)
        {
            return await _context.Vendors
                .AnyAsync(v => v.Id == id);
        }

        public async Task<bool> ExistsByNameAsync(string name)
        {
            return await _context.Vendors
                .AnyAsync(v => v.Name == name);
        }
        public async Task<Vendor> GetByPhoneAsync(string phone)
        {
            return await _context.Vendors
                .FirstOrDefaultAsync(v => v.Phone == phone);
        }

        public async Task<Vendor> GetByOwnerIdAsync(Guid ownerId)
        {
            return await _context.Vendors
                .FirstOrDefaultAsync(v => v.OwnerId == ownerId);
        }
        // =======================
        // Pagination 
        // =======================
        public async Task<PagedResult<Vendor>> GetPagedAsync(
            string searchTerm = null,
            bool? onlyActive = null,
            int pageNumber = 1,
            int pageSize = 20)
        {
            var query = _context.Vendors.AsNoTracking().AsQueryable();

            if (onlyActive.HasValue && onlyActive.Value)
                query = query.Where(v => v.IsActive);

            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                searchTerm = searchTerm.Trim().ToLower();
                query = query.Where(v =>
                    (v.Name != null && v.Name.ToLower().Contains(searchTerm)) ||
                    (v.Phone != null && v.Phone.Contains(searchTerm)) ||
                    (v.NameAr != null && v.NameAr.Contains(searchTerm)) 
                    //||
                    //(v.Email != null && v.Email.ToLower().Contains(searchTerm))
                );
            }

            query = query.OrderByDescending(v => v.CreatedAt);

            return await query.ToPagedListAsync(pageNumber, pageSize);
        }
    }
}
