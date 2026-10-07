using Microsoft.EntityFrameworkCore;
using ecommerce.Core.Models;
using ecommerce.Data;

namespace ecommerce.Repositories
{
    public class AddressRepository : IAddressRepository
    {
        private readonly AppDbContext _context;

        public AddressRepository(AppDbContext context)
        {
            _context = context;
        }
        public async Task<IEnumerable<Address>> GetAllAsync()
        {
            return await _context.Addresses
                .Include(a => a.Zone)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();
        }
        public async Task<Address> GetByIdAsync(Guid id)
        {
            return await _context.Addresses
                .Include(a => a.Zone)
                .FirstOrDefaultAsync(a => a.Id == id);
        }

        public async Task<IEnumerable<Address>> GetByUserIdAsync(Guid userId)
        {
            return await _context.Addresses
                .Include(a => a.Zone)
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.IsDefault)
                .ThenByDescending(a => a.CreatedAt)
                .ToListAsync();
        }

        public async Task<Address> GetDefaultByUserIdAsync(Guid userId)
        {
            return await _context.Addresses
                .FirstOrDefaultAsync(a => a.UserId == userId && a.IsDefault);
        }

        public async Task<Address> CreateAsync(Address address)
        {
            address.CreatedAt = DateTime.UtcNow;
            address.UpdatedAt = DateTime.UtcNow;

            // إذا العنوان افتراضي → ألغِ الافتراضي السابق
            if (address.IsDefault)
            {
                var defaults = await _context.Addresses
                    .Where(a => a.UserId == address.UserId && a.IsDefault)
                    .ToListAsync();

                foreach (var addr in defaults)
                    addr.IsDefault = false;
            }

            await _context.Addresses.AddAsync(address);
            await _context.SaveChangesAsync();

            return address;
        }

        public async Task<Address> UpdateAsync(Address address)
        {
            address.UpdatedAt = DateTime.UtcNow;

            if (address.IsDefault)
            {
                var defaults = await _context.Addresses
                    .Where(a => a.UserId == address.UserId &&
                                a.IsDefault &&
                                a.Id != address.Id)
                    .ToListAsync();

                foreach (var addr in defaults)
                    addr.IsDefault = false;
            }

            _context.Addresses.Update(address);
            await _context.SaveChangesAsync();

            return address;
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            var address = await GetByIdAsync(id);
            if (address == null)
                return false;

            _context.Addresses.Remove(address);
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<bool> ExistsAsync(Guid id)
        {
            return await _context.Addresses
                .AnyAsync(a => a.Id == id);
        }
    }
}
