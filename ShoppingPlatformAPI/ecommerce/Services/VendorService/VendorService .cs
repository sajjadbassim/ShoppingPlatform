using ecommerce.Core.Exceptions;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Vendor;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services.FileService;
using ecommerce.Services.NotificationService;
using System.Numerics;

namespace ecommerce.Services.VendorService.VendorService
{
    public class VendorService : IVendorService
    {
        private readonly IVendorRepository _vendorRepository;
        private readonly IFileService _fileService;
        private readonly INotificationService _notificationService;
        private readonly IProductRepository _productRepository;
        private readonly IUserRepository? _userRepository;

        public VendorService(
            IVendorRepository vendorRepository,
            IFileService fileService,
            INotificationService notificationService,
            IProductRepository productRepository,
            IUserRepository? userRepository = null)
        {
            _userRepository = userRepository;
            _vendorRepository = vendorRepository;
            _fileService = fileService;
            _notificationService = notificationService;
            _productRepository = productRepository;
        }
        // ✅ CreateAsync المحدث - مع رفع اللوجو
        public async Task<VendorResponseDto> CreateAsync(VendorCreateDto dto, Guid? ownerId = null, bool byAdmin = false)
        {
            dto.Name = (dto.Name ?? "").Trim();
            dto.NameAr = dto.NameAr?.Trim();
            if (dto.Name.Length < 2)
                throw new Exception("اسم المتجر مطلوب");

            if (await _vendorRepository.NameTakenAsync(dto.Name, dto.NameAr))
                throw new Exception("اسم المتجر مستخدم لمتجر آخر");

            if (byAdmin)
            {
                // الإدارة تنشئ متجراً بلا مالك وتحدد تفعيله بنفسها
                ownerId = null;
            }
            else
            {
                // طلب فتح متجر من حساب زبون: متجر واحد، ويبقى غير مفعّل حتى توافق الإدارة
                if (ownerId == null || _userRepository == null)
                    throw new Exception("سجّل الدخول أولاً");
                var owner = await _userRepository.GetByIdAsync(ownerId.Value);
                if (owner == null || owner.Role != UserRoles.Customer)
                    throw new ForbiddenException("فتح متجر متاح لحسابات الزبائن فقط");
                if (await _vendorRepository.GetByOwnerIdAsync(ownerId.Value) != null)
                    throw new Exception("لديك متجر أو طلب متجر مسبقاً");
                dto.IsActive = false;
            }

            string logoUrl = "";

            // ✅ رفع اللوجو إذا وجد
            if (dto.Logo != null)
            {
                try
                {
                    logoUrl = await _fileService.SaveImageAsync(dto.Logo, "vendors");
                }
                catch (Exception ex)
                {
                    throw new Exception($"فشل رفع اللوجو: {ex.Message}");
                }
            }

            string coverUrl = "";

            // ✅ رفع صورة الغلاف إذا وجدت
            if (dto.Cover != null)
            {
                try
                {
                    coverUrl = await _fileService.SaveImageAsync(dto.Cover, "vendors/covers");
                }
                catch (Exception ex)
                {
                    throw new Exception($"فشل رفع صورة الغلاف: {ex.Message}");
                }
            }

            var vendor = new Vendor
            {
                Name = dto.Name,
                NameAr = dto.NameAr,
                Description = dto.Description,
                LogoUrl = logoUrl, //
                CoverImageUrl = coverUrl,
                Phone = dto.Phone,
                Address = dto.Address,
                IsActive = dto.IsActive,
                MinOrderAmount = dto.MinOrderAmount,
                DeliveryFee = dto.DeliveryFee,
                EstimatedPrepTime = dto.EstimatedPrepTime,
                OwnerId = ownerId
            };

            var createdVendor = await _vendorRepository.CreateAsync(vendor);

            // ✅ إشعار الأدمن بمتجر جديد يحتاج تفعيل
            if (!createdVendor.IsActive)
            {
                try
                {
                    await _notificationService.NotifyAdminsAsync(
                        NotificationCategory.NewVendors, NotificationType.NEW_VENDOR,
                        $"بائع جديد يحتاج تفعيل: {createdVendor.NameAr ?? createdVendor.Name}",
                        new { vendorId = createdVendor.Id });
                }
                catch { /* لا نفشل إنشاء المتجر بسبب فشل الإشعار */ }
            }

            return await MapToDtoAsync(createdVendor);
        }
        public async Task<VendorResponseDto> GetByIdAsync(Guid id)
        {
            var vendor = await _vendorRepository.GetByIdAsync(id);
            if (vendor == null)
                throw new Exception("التاجر غير موجود");

            return await MapToDtoAsync(vendor);
        }

        public async Task<IEnumerable<VendorResponseDto>> GetAllAsync(bool onlyActive = true)
        {
            var vendors = await _vendorRepository.GetAllAsync(onlyActive);

            // ✅ تسلسلياً وليس Task.WhenAll — DbContext لا يدعم عمليات متزامنة على نفس الـ instance
            var dtos = new List<VendorResponseDto>();
            foreach (var vendor in vendors)
                dtos.Add(await MapToDtoAsync(vendor));

            return dtos;
        }

        // ✅ UpdateAsync المحدث - مع رفع لوجو جديد
        public async Task<VendorResponseDto> UpdateAsync(Guid id, VendorUpdateDto dto)
        {
            var vendor = await _vendorRepository.GetByIdAsync(id);
            if (vendor == null)
                throw new Exception("التاجر غير موجود");

            // ✅ رفع لوجو جديد إذا وجد
            if (dto.NewLogo != null)
            {
                try
                {
                    // حذف اللوجو القديم
                    if (!string.IsNullOrWhiteSpace(vendor.LogoUrl))
                        await _fileService.DeleteImageAsync(vendor.LogoUrl);

                    // رفع اللوجو الجديد
                    vendor.LogoUrl = await _fileService.SaveImageAsync(dto.NewLogo, "vendors");
                }
                catch (Exception ex)
                {
                    throw new Exception($"فشل تحديث اللوجو: {ex.Message}");
                }
            }

            // ✅ رفع صورة غلاف جديدة إذا وجدت
            if (dto.NewCover != null)
            {
                try
                {
                    // حذف صورة الغلاف القديمة
                    if (!string.IsNullOrWhiteSpace(vendor.CoverImageUrl))
                        await _fileService.DeleteImageAsync(vendor.CoverImageUrl);

                    // رفع صورة الغلاف الجديدة
                    vendor.CoverImageUrl = await _fileService.SaveImageAsync(dto.NewCover, "vendors/covers");
                }
                catch (Exception ex)
                {
                    throw new Exception($"فشل تحديث صورة الغلاف: {ex.Message}");
                }
            }

            // تحديث باقي الحقول
            if (!string.IsNullOrWhiteSpace(dto.Name))
                vendor.Name = dto.Name;

            if (!string.IsNullOrWhiteSpace(dto.NameAr))
                vendor.NameAr = dto.NameAr;

            if (dto.Description != null)
                vendor.Description = dto.Description;

            if (!string.IsNullOrWhiteSpace(dto.Phone))
                vendor.Phone = dto.Phone;

            if (dto.Address != null)
                vendor.Address = dto.Address;

            var activating = dto.IsActive == true && !vendor.IsActive;
            if (dto.IsActive.HasValue)
                vendor.IsActive = dto.IsActive.Value;

            if (dto.MinOrderAmount.HasValue)
                vendor.MinOrderAmount = dto.MinOrderAmount.Value;

            if (dto.DeliveryFee.HasValue)
                vendor.DeliveryFee = dto.DeliveryFee.Value;

            if (dto.EstimatedPrepTime.HasValue)
                vendor.EstimatedPrepTime = dto.EstimatedPrepTime.Value;

            var updatedVendor = await _vendorRepository.UpdateAsync(vendor);

            if (activating) await ApproveOwnerAsync(vendor.Id);
            return await MapToDtoAsync(updatedVendor);
        }


        // ✅ تحديث اللوجو فقط
        public async Task<VendorResponseDto> UpdateLogoAsync(Guid id, IFormFile logo)
        {
            var vendor = await _vendorRepository.GetByIdAsync(id);
            if (vendor == null)
                throw new Exception("التاجر غير موجود");

            if (logo == null)
                throw new Exception("اللوجو مطلوب");

            // حذف اللوجو القديم
            if (!string.IsNullOrWhiteSpace(vendor.LogoUrl))
                await _fileService.DeleteImageAsync(vendor.LogoUrl);

            // رفع اللوجو الجديد
            vendor.LogoUrl = await _fileService.SaveImageAsync(logo, "vendors");

            var updated = await _vendorRepository.UpdateAsync(vendor);
            return await MapToDtoAsync(updated);
        }

        // ✅ حذف اللوجو
        public async Task<bool> DeleteLogoAsync(Guid id)
        {
            var vendor = await _vendorRepository.GetByIdAsync(id);
            if (vendor == null)
                return false;

            if (string.IsNullOrWhiteSpace(vendor.LogoUrl))
                return false;

            // حذف اللوجو من السيرفر
            await _fileService.DeleteImageAsync(vendor.LogoUrl);

            // إزالة المسار من قاعدة البيانات
            vendor.LogoUrl = null;
            await _vendorRepository.UpdateAsync(vendor);

            return true;
        }

        // ✅ DeleteAsync المحدث - مع حذف اللوجو
        public async Task<bool> DeleteAsync(Guid id)
        {
            var vendor = await _vendorRepository.GetByIdAsync(id);
            if (vendor == null)
                return false;

            // حذف اللوجو إن وجد
            if (!string.IsNullOrWhiteSpace(vendor.LogoUrl))
                await _fileService.DeleteImageAsync(vendor.LogoUrl);

            return await _vendorRepository.DeleteAsync(id);
        }
        // Helper method للتحويل من Model إلى DTO
        public async Task<VendorResponseDto> GetByPhoneAsync(string phone)
        {
            var vendor = await _vendorRepository.GetByPhoneAsync(phone);
            if (vendor == null)
                throw new Exception("التاجر غير موجود");

            return await MapToDtoAsync(vendor);
        }



        // =======================
        // Pagination
        // =======================
        public async Task<PagedResponse<VendorResponseDto>> GetVendorsPagedAsync(
            string searchTerm = null,
            bool? onlyActive = null,
            int pageNumber = 1,
            int pageSize = 20)
        {
            var paged = await _vendorRepository.GetPagedAsync(searchTerm, onlyActive, pageNumber, pageSize);

            // ✅ تسلسلياً وليس Task.WhenAll — DbContext لا يدعم عمليات متزامنة على نفس الـ instance
            var dtos = new List<VendorResponseDto>();
            foreach (var vendor in paged.Items)
                dtos.Add(await MapToDtoAsync(vendor));

            return new PagedResponse<VendorResponseDto>(
                dtos,
                paged.TotalCount,
                paged.PageNumber,
                paged.PageSize
            );
        }

        // تفعيل متجر لأول مرة: صاحبه الزبون يصبح بائعاً ويُبلَّغ — في الخادم وفي نفس العملية
        public async Task<bool> ApproveOwnerAsync(Guid vendorId)
        {
            var vendor = await _vendorRepository.GetByIdAsync(vendorId);
            if (vendor?.OwnerId == null || _userRepository == null) return false;

            var owner = await _userRepository.GetByIdAsync(vendor.OwnerId.Value);
            if (owner == null || owner.Role != UserRoles.Customer) return false;

            owner.Role = UserRoles.Vendor;
            await _userRepository.UpdateAsync(owner);
            try
            {
                await _notificationService.NotifyCustomerAsync(owner.Id,
                    $"تمت الموافقة على متجرك «{vendor.NameAr ?? vendor.Name}» 🎉 سجّل الدخول من جديد لتفتح لوحة البائع",
                    new { vendorId = vendor.Id });
            }
            catch { /* الإشعار لا يُفشل التفعيل */ }
            return true;
        }

        private async Task<VendorResponseDto> MapToDtoAsync(Vendor vendor)
        {
            var productsCount = await _productRepository.GetCountAsync(vendorId: vendor.Id, publicOnly: false);
            var (rating, ratingsCount) = await _vendorRepository.GetRatingSummaryAsync(vendor.Id);

            return new VendorResponseDto
            {
                Id = vendor.Id,
                OwnerId = vendor.OwnerId,
                Name = vendor.Name ?? "",
                NameAr = vendor.NameAr ?? "",
                Description = vendor.Description ?? "",
                LogoUrl = vendor.LogoUrl,
                CoverImageUrl = vendor.CoverImageUrl,
                Phone = vendor.Phone ?? "",
                Address = vendor.Address ?? "",
                IsActive = vendor.IsActive,
                MinOrderAmount = vendor.MinOrderAmount,
                DeliveryFee = vendor.DeliveryFee,
                EstimatedPrepTime = vendor.EstimatedPrepTime,
                ProductsCount = productsCount,
                Rating = rating,
                RatingsCount = ratingsCount,
                CreatedAt = vendor.CreatedAt
            };
        }
    }
}
