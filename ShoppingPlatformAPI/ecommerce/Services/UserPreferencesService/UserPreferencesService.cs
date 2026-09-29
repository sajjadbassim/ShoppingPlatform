using ecommerce.Core.DTO.Users;
using ecommerce.Core.Interfaces;
using ecommerce.Core.Models;
using ecommerce.Repositories;

namespace ecommerce.Services.UserPreferencesService
{
    public class UserPreferencesService : IUserPreferencesService
    {
        private readonly IUserPreferencesRepository _preferencesRepository;
        private readonly IUnitOfWork _unitOfWork;

        public UserPreferencesService(IUserPreferencesRepository preferencesRepository, IUnitOfWork unitOfWork)
        {
            _preferencesRepository = preferencesRepository;
            _unitOfWork = unitOfWork;
        }

        // من لا يملك سجلاً بعد تُرجَع له القيم الافتراضية دون إنشاء سجل
        public async Task<UserPreferencesResponseDto> GetAsync(Guid userId, CancellationToken ct = default)
        {
            var preferences = await _preferencesRepository.GetByUserIdAsync(userId, ct)
                ?? new UserPreferences { UserId = userId };

            return MapToDto(preferences);
        }

        // ينشئ السجل عند أول حفظ، والحقول غير المُرسلة لا تتغير
        public async Task<UserPreferencesResponseDto> UpdateAsync(Guid userId, UserPreferencesUpdateDto dto, CancellationToken ct = default)
        {
            var preferences = await _preferencesRepository.GetByUserIdAsync(userId, ct);
            if (preferences == null)
            {
                preferences = new UserPreferences { UserId = userId };
                await _preferencesRepository.AddAsync(preferences, ct);
            }

            if (dto.Language != null) preferences.Language = dto.Language;
            if (dto.Theme != null) preferences.Theme = dto.Theme;
            if (dto.Currency != null) preferences.Currency = dto.Currency;

            if (dto.NotifyOrderUpdates.HasValue) preferences.NotifyOrderUpdates = dto.NotifyOrderUpdates.Value;
            if (dto.NotifyNewOrders.HasValue) preferences.NotifyNewOrders = dto.NotifyNewOrders.Value;
            if (dto.NotifyOrderConfirmations.HasValue) preferences.NotifyOrderConfirmations = dto.NotifyOrderConfirmations.Value;
            if (dto.NotifyLowStock.HasValue) preferences.NotifyLowStock = dto.NotifyLowStock.Value;
            if (dto.NotifyReviews.HasValue) preferences.NotifyReviews = dto.NotifyReviews.Value;
            if (dto.NotifyReturns.HasValue) preferences.NotifyReturns = dto.NotifyReturns.Value;
            if (dto.NotifyNewUsers.HasValue) preferences.NotifyNewUsers = dto.NotifyNewUsers.Value;
            if (dto.NotifyNewVendors.HasValue) preferences.NotifyNewVendors = dto.NotifyNewVendors.Value;

            await _unitOfWork.SaveChangesAsync(ct);

            return MapToDto(preferences);
        }

        private static UserPreferencesResponseDto MapToDto(UserPreferences p) => new()
        {
            Language = p.Language,
            Theme = p.Theme,
            Currency = p.Currency,
            NotifyOrderUpdates = p.NotifyOrderUpdates,
            NotifyNewOrders = p.NotifyNewOrders,
            NotifyOrderConfirmations = p.NotifyOrderConfirmations,
            NotifyLowStock = p.NotifyLowStock,
            NotifyReviews = p.NotifyReviews,
            NotifyReturns = p.NotifyReturns,
            NotifyNewUsers = p.NotifyNewUsers,
            NotifyNewVendors = p.NotifyNewVendors
        };
    }
}
