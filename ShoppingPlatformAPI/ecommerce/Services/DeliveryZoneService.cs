using System.ComponentModel.DataAnnotations;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services
{
    public static class ZonesMode
    {
        public const string Off = "OFF";
        public const string All = "ALL";
        public const string Selected = "SELECTED";
        public static bool IsValid(string? m) => m is Off or All or Selected;
    }

    // قاعدة رسوم التوصيل لعنوان معيّن: سعر المنطقة للمتاجر المشمولة، وإلا سعر المتجر الثابت
    public class DeliveryFeeRules
    {
        public string Mode { get; init; } = ZonesMode.Off;
        public DeliveryZone? Zone { get; init; }          // منطقة العنوان إن كانت مفعّلة

        public bool Covers(Vendor v) => Mode == ZonesMode.All || (Mode == ZonesMode.Selected && v.UseDeliveryZones);
        public bool UsesZone(Vendor v) => Zone != null && Covers(v);
        public decimal FeeFor(Vendor v) => UsesZone(v) ? Zone!.Fee : v.DeliveryFee;

        public static async Task<DeliveryFeeRules> LoadAsync(AppDbContext context, Guid? zoneId, CancellationToken ct = default)
        {
            var mode = await context.DeliverySettings.AsNoTracking().Select(s => s.ZonesMode).FirstOrDefaultAsync(ct);
            if (!ZonesMode.IsValid(mode) || mode == ZonesMode.Off || zoneId == null)
                return new DeliveryFeeRules { Mode = ZonesMode.IsValid(mode) ? mode! : ZonesMode.Off };
            var zone = await context.DeliveryZones.AsNoTracking().FirstOrDefaultAsync(z => z.Id == zoneId && z.IsActive, ct);
            return new DeliveryFeeRules { Mode = mode!, Zone = zone };
        }
    }

    // ===== DTOs =====
    public class DeliveryZoneDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = "";
        public decimal Fee { get; set; }
        public bool IsActive { get; set; }
        public int SortOrder { get; set; }
        public int AddressCount { get; set; }
    }

    public class SaveDeliveryZoneDto
    {
        [Required(ErrorMessage = "اسم المنطقة مطلوب")]
        [MaxLength(100, ErrorMessage = "اسم المنطقة طويل جداً")]
        public string Name { get; set; } = "";

        [Range(0, 1_000_000, ErrorMessage = "سعر التوصيل غير صالح")]
        public decimal Fee { get; set; }

        public bool IsActive { get; set; } = true;
        public int SortOrder { get; set; }
    }

    public class SetZonesModeDto
    {
        [Required] public string Mode { get; set; } = ZonesMode.Off;
        public List<Guid>? VendorIds { get; set; }
    }

    public class ZoneVendorDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = "";
        public bool IsActive { get; set; }
        public decimal DeliveryFee { get; set; }
        public bool UseDeliveryZones { get; set; }
    }

    // للإدارة: كل شيء
    public class ZonesAdminDto
    {
        public string Mode { get; set; } = ZonesMode.Off;
        public List<DeliveryZoneDto> Zones { get; set; } = new();
        public List<ZoneVendorDto> Vendors { get; set; } = new();
    }

    // للزبون: المناطق المفعّلة والمتاجر المشمولة (لعرض «حسب منطقتك»)
    public class ZonesPublicDto
    {
        public bool Enabled { get; set; }
        public string Mode { get; set; } = ZonesMode.Off;
        public List<Guid> VendorIds { get; set; } = new();     // عند SELECTED فقط
        public List<DeliveryZoneDto> Zones { get; set; } = new();
    }

    public class DeliveryQuoteLineDto
    {
        public Guid VendorId { get; set; }
        public string VendorName { get; set; } = "";
        public decimal Fee { get; set; }
        public bool ByZone { get; set; }
    }

    public class DeliveryQuoteDto
    {
        public string? ZoneName { get; set; }
        public decimal Total { get; set; }
        public List<DeliveryQuoteLineDto> Vendors { get; set; } = new();
    }

    public interface IDeliveryZoneService
    {
        Task<ZonesPublicDto> GetPublicAsync(CancellationToken ct = default);
        Task<ZonesAdminDto> GetAdminAsync(CancellationToken ct = default);
        Task<DeliveryZoneDto> CreateAsync(SaveDeliveryZoneDto dto, CancellationToken ct = default);
        Task<DeliveryZoneDto> UpdateAsync(Guid id, SaveDeliveryZoneDto dto, CancellationToken ct = default);
        Task DeleteAsync(Guid id, CancellationToken ct = default);
        Task<ZonesAdminDto> SetModeAsync(SetZonesModeDto dto, Guid userId, CancellationToken ct = default);
        Task<DeliveryQuoteDto> QuoteAsync(Guid userId, Guid? addressId, Guid? zoneId, CancellationToken ct = default);
    }

    public class DeliveryZoneService : IDeliveryZoneService
    {
        private readonly AppDbContext _context;

        public DeliveryZoneService(AppDbContext context) => _context = context;

        private async Task<string> ModeAsync(CancellationToken ct)
        {
            var mode = await _context.DeliverySettings.AsNoTracking().Select(s => s.ZonesMode).FirstOrDefaultAsync(ct);
            return ZonesMode.IsValid(mode) ? mode! : ZonesMode.Off;
        }

        private async Task<List<DeliveryZoneDto>> ZonesAsync(bool activeOnly, CancellationToken ct)
        {
            var q = _context.DeliveryZones.AsNoTracking();
            if (activeOnly) q = q.Where(z => z.IsActive);
            return await q.OrderBy(z => z.SortOrder).ThenBy(z => z.Name)
                .Select(z => new DeliveryZoneDto
                {
                    Id = z.Id, Name = z.Name, Fee = z.Fee, IsActive = z.IsActive, SortOrder = z.SortOrder,
                    AddressCount = activeOnly ? 0 : _context.Addresses.Count(a => a.ZoneId == z.Id),
                })
                .ToListAsync(ct);
        }

        public async Task<ZonesPublicDto> GetPublicAsync(CancellationToken ct = default)
        {
            var mode = await ModeAsync(ct);
            if (mode == ZonesMode.Off) return new ZonesPublicDto();
            var zones = await ZonesAsync(true, ct);
            return new ZonesPublicDto
            {
                Enabled = zones.Count > 0,
                Mode = mode,
                Zones = zones,
                VendorIds = mode == ZonesMode.Selected
                    ? await _context.Vendors.AsNoTracking().Where(v => v.UseDeliveryZones).Select(v => v.Id).ToListAsync(ct)
                    : new List<Guid>(),
            };
        }

        public async Task<ZonesAdminDto> GetAdminAsync(CancellationToken ct = default) => new()
        {
            Mode = await ModeAsync(ct),
            Zones = await ZonesAsync(false, ct),
            Vendors = await _context.Vendors.AsNoTracking().OrderBy(v => v.Name)
                .Select(v => new ZoneVendorDto { Id = v.Id, Name = v.Name, IsActive = v.IsActive, DeliveryFee = v.DeliveryFee, UseDeliveryZones = v.UseDeliveryZones })
                .ToListAsync(ct),
        };

        private async Task ValidateAsync(SaveDeliveryZoneDto dto, Guid? id, CancellationToken ct)
        {
            dto.Name = (dto.Name ?? "").Trim();
            if (dto.Name.Length == 0) throw new BusinessRuleException("اسم المنطقة مطلوب");
            if (dto.Name.Length > 100) throw new BusinessRuleException("اسم المنطقة طويل جداً");
            if (dto.Fee < 0 || dto.Fee > 1_000_000) throw new BusinessRuleException("سعر التوصيل غير صالح");
            var lower = dto.Name.ToLower();
            if (await _context.DeliveryZones.AnyAsync(z => z.Name.ToLower() == lower && z.Id != id, ct))
                throw new BusinessRuleException("توجد منطقة بهذا الاسم");
        }

        private static DeliveryZoneDto Map(DeliveryZone z, int addresses = 0) => new()
        { Id = z.Id, Name = z.Name, Fee = z.Fee, IsActive = z.IsActive, SortOrder = z.SortOrder, AddressCount = addresses };

        public async Task<DeliveryZoneDto> CreateAsync(SaveDeliveryZoneDto dto, CancellationToken ct = default)
        {
            await ValidateAsync(dto, null, ct);
            var zone = new DeliveryZone { Name = dto.Name, Fee = dto.Fee, IsActive = dto.IsActive, SortOrder = dto.SortOrder };
            _context.DeliveryZones.Add(zone);
            await _context.SaveChangesAsync(ct);
            return Map(zone);
        }

        public async Task<DeliveryZoneDto> UpdateAsync(Guid id, SaveDeliveryZoneDto dto, CancellationToken ct = default)
        {
            var zone = await _context.DeliveryZones.FirstOrDefaultAsync(z => z.Id == id, ct)
                ?? throw new NotFoundException("المنطقة غير موجودة");
            await ValidateAsync(dto, id, ct);
            zone.Name = dto.Name;
            zone.Fee = dto.Fee;
            zone.IsActive = dto.IsActive;
            zone.SortOrder = dto.SortOrder;
            zone.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(ct);
            return Map(zone, await _context.Addresses.CountAsync(a => a.ZoneId == id, ct));
        }

        public async Task DeleteAsync(Guid id, CancellationToken ct = default)
        {
            var zone = await _context.DeliveryZones.FirstOrDefaultAsync(z => z.Id == id, ct)
                ?? throw new NotFoundException("المنطقة غير موجودة");
            // العناوين تبقى بلا منطقة (سعر المتجر الثابت) — الطلبات السابقة تحتفظ باسم منطقتها
            var addresses = await _context.Addresses.Where(a => a.ZoneId == id).ToListAsync(ct);
            foreach (var a in addresses) a.ZoneId = null;
            _context.DeliveryZones.Remove(zone);
            await _context.SaveChangesAsync(ct);
        }

        public async Task<ZonesAdminDto> SetModeAsync(SetZonesModeDto dto, Guid userId, CancellationToken ct = default)
        {
            var mode = (dto.Mode ?? "").Trim().ToUpperInvariant();
            if (!ZonesMode.IsValid(mode)) throw new BusinessRuleException("خيار المناطق غير صالح");

            var settings = await _context.DeliverySettings.FirstOrDefaultAsync(ct);
            if (settings == null)
            {
                settings = new DeliverySettings();
                _context.DeliverySettings.Add(settings);
            }
            settings.ZonesMode = mode;
            settings.UpdatedAt = DateTime.UtcNow;
            settings.UpdatedBy = userId;

            // قائمة المتاجر المحددة تُحفظ فقط عند إرسالها (تبقى محفوظة إن عادت الإدارة لـ «الكل» أو «إيقاف»)
            if (dto.VendorIds != null)
            {
                var selected = dto.VendorIds.ToHashSet();
                foreach (var v in await _context.Vendors.ToListAsync(ct))
                    v.UseDeliveryZones = selected.Contains(v.Id);
            }
            await _context.SaveChangesAsync(ct);
            return await GetAdminAsync(ct);
        }

        public async Task<DeliveryQuoteDto> QuoteAsync(Guid userId, Guid? addressId, Guid? zoneId, CancellationToken ct = default)
        {
            if (addressId != null)
            {
                var address = await _context.Addresses.AsNoTracking().FirstOrDefaultAsync(a => a.Id == addressId, ct)
                    ?? throw new NotFoundException("العنوان غير موجود");
                if (address.UserId != userId) throw new ForbiddenException("هذا العنوان غير مسجل باسمك");
                zoneId = address.ZoneId;
            }

            var rules = await DeliveryFeeRules.LoadAsync(_context, zoneId, ct);
            var vendors = await _context.CartItems.AsNoTracking()
                .Where(i => i.Cart.UserId == userId)
                .Select(i => i.Product.Vendor)
                .Distinct()
                .ToListAsync(ct);

            var lines = vendors.Select(v => new DeliveryQuoteLineDto
            {
                VendorId = v.Id, VendorName = v.Name, Fee = rules.FeeFor(v), ByZone = rules.UsesZone(v),
            }).ToList();

            return new DeliveryQuoteDto
            {
                ZoneName = lines.Any(l => l.ByZone) ? rules.Zone?.Name : null,
                Total = lines.Sum(l => l.Fee),
                Vendors = lines,
            };
        }
    }
}
