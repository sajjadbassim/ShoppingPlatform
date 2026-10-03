using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Loyalty;
using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services.LoyaltyService
{
    public class LoyaltyService : ILoyaltyService
    {
        private readonly AppDbContext _context;

        public LoyaltyService(AppDbContext context)
        {
            _context = context;
        }

        // ===================================
        // GetAccountAsync
        // ===================================
        public async Task<LoyaltyAccountDto> GetAccountAsync(Guid userId)
        {
            var account = await _context.LoyaltyAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.UserId == userId);

            if (account == null)
                throw new Exception("حساب النقاط غير موجود");

            var settings = await GetSettingsEntityAsync();
            return MapToDto(account, settings);
        }

        // ===================================
        // GetOrCreateAccountAsync
        // ===================================
        public async Task<LoyaltyAccountDto> GetOrCreateAccountAsync(Guid userId)
        {
            var account = await _context.LoyaltyAccounts
                .FirstOrDefaultAsync(a => a.UserId == userId);

            if (account == null)
            {
                account = new LoyaltyAccount { UserId = userId };
                await _context.LoyaltyAccounts.AddAsync(account);
                await _context.SaveChangesAsync();
            }

            var settings = await GetSettingsEntityAsync();
            return MapToDto(account, settings);
        }

        // ===================================
        // GetTransactionsAsync
        // ===================================
        public async Task<LoyaltyTransactionPagedDto> GetTransactionsAsync(Guid userId, PaginationParams pagination)
        {
            var account = await _context.LoyaltyAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.UserId == userId);

            if (account == null)
                return new LoyaltyTransactionPagedDto
                {
                    Data = new List<LoyaltyTransactionDto>(),
                    Pagination = new PaginationMetadata
                    {
                        CurrentPage = pagination.PageNumber,
                        PageSize = pagination.PageSize,
                        TotalCount = 0,
                        TotalPages = 0
                    }
                };

            var query = _context.LoyaltyTransactions
                .Include(t => t.Order)
                .Where(t => t.AccountId == account.Id)
                .OrderByDescending(t => t.CreatedAt)
                .AsNoTracking();

            var totalCount = await query.CountAsync();

            var transactions = await query
                .Skip((pagination.PageNumber - 1) * pagination.PageSize)
                .Take(pagination.PageSize)
                .ToListAsync();

            return new LoyaltyTransactionPagedDto
            {
                Data = transactions.Select(MapTransactionToDto).ToList(),
                Pagination = new PaginationMetadata
                {
                    CurrentPage = pagination.PageNumber,
                    PageSize = pagination.PageSize,
                    TotalCount = totalCount,
                    TotalPages = (int)Math.Ceiling((double)totalCount / pagination.PageSize)
                }
            };
        }

        // ===================================
        // EarnPointsAsync — يُستدعى من OrderService
        // عند تغيير حالة الطلب إلى DELIVERED
        // ===================================
        public async Task EarnPointsAsync(Guid userId, Guid orderId, decimal orderAmount)
        {
            var settings = await GetSettingsEntityAsync();
            if (!settings.IsActive) return;

            // التحقق أن الطلب لم يُكسب نقاطاً من قبل
            var alreadyEarned = await _context.LoyaltyTransactions
                .AnyAsync(t => t.OrderId == orderId && t.Type == LoyaltyTransactionType.Earned);
            if (alreadyEarned) return;

            var account = await EnsureAccountAsync(userId);

            // حساب النقاط مع مضاعف الـ Tier
            var multiplier = GetTierMultiplier(account.Tier, settings);
            var basePoints = (int)Math.Floor(orderAmount * settings.PointsPerCurrencyUnit);
            var pointsToEarn = (int)Math.Floor(basePoints * multiplier);

            if (pointsToEarn <= 0) return;

            account.Balance += pointsToEarn;
            account.TotalEarned += pointsToEarn;
            account.UpdatedAt = DateTime.UtcNow;

            // تحديث الـ Tier
            account.Tier = CalculateTier(account.TotalEarned, settings);

            // تاريخ انتهاء النقاط
            var expiresAt = settings.PointsExpiryDays > 0
                ? DateTime.UtcNow.AddDays(settings.PointsExpiryDays)
                : (DateTime?)null;

            var transaction = new LoyaltyTransaction
            {
                AccountId = account.Id,
                Type = LoyaltyTransactionType.Earned,
                Points = pointsToEarn,
                BalanceAfter = account.Balance,
                Description = $"نقاط مكتسبة من الطلب — قيمة {orderAmount:F2}",
                DescriptionAr = $"نقاط مكتسبة من الطلب — قيمة {orderAmount:F2}",
                OrderId = orderId,
                ExpiresAt = expiresAt
            };

            await _context.LoyaltyTransactions.AddAsync(transaction);
            await _context.SaveChangesAsync();
        }

        // ===================================
        // EarnReviewPointsAsync — يُستدعى من ReviewService
        // عند كتابة تقييم لمنتج (مرة واحدة لكل منتج حتى لو حُذف التقييم وأعيدت كتابته)
        // ===================================
        public async Task<int> EarnReviewPointsAsync(Guid userId, Guid productId)
        {
            var settings = await GetSettingsEntityAsync();
            if (!settings.IsActive || settings.ReviewPoints <= 0) return 0;

            var account = await EnsureAccountAsync(userId);

            var referenceKey = $"review:{productId}";
            var alreadyEarned = await _context.LoyaltyTransactions
                .AnyAsync(t => t.AccountId == account.Id && t.ReferenceKey == referenceKey);
            if (alreadyEarned) return 0;

            var points = settings.ReviewPoints;

            account.Balance += points;
            account.TotalEarned += points;
            account.UpdatedAt = DateTime.UtcNow;
            account.Tier = CalculateTier(account.TotalEarned, settings);

            var expiresAt = settings.PointsExpiryDays > 0
                ? DateTime.UtcNow.AddDays(settings.PointsExpiryDays)
                : (DateTime?)null;

            var transaction = new LoyaltyTransaction
            {
                AccountId = account.Id,
                Type = LoyaltyTransactionType.Earned,
                Points = points,
                BalanceAfter = account.Balance,
                Description = "Points earned for writing a review",
                DescriptionAr = "نقاط مكتسبة من كتابة تقييم",
                ReferenceKey = referenceKey,
                ExpiresAt = expiresAt
            };

            await _context.LoyaltyTransactions.AddAsync(transaction);
            await _context.SaveChangesAsync();

            return points;
        }

        // ===================================
        // GetEstimateAsync — تقدير قبل الطلب
        // ===================================
        public async Task<LoyaltyEstimateDto> GetEstimateAsync(Guid userId, decimal orderAmount)
        {
            var settings = await GetSettingsEntityAsync();

            var account = await _context.LoyaltyAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.UserId == userId);

            int currentBalance = account?.Balance ?? 0;
            string tier = account?.Tier ?? LoyaltyTier.Bronze;

            var multiplier = GetTierMultiplier(tier, settings);
            var pointsToEarn = (int)Math.Floor(orderAmount * settings.PointsPerCurrencyUnit * multiplier);

            // أقصى نقاط قابلة للصرف
            var maxDiscountFromOrder = orderAmount * (settings.MaxRedemptionPercentage / 100m);
            var pointsEquivalent = maxDiscountFromOrder / settings.PointValue;
            var maxRedeemable = (int)Math.Min(currentBalance, Math.Floor(pointsEquivalent));

            if (maxRedeemable < settings.MinRedemptionPoints)
                maxRedeemable = 0;

            return new LoyaltyEstimateDto
            {
                PointsToEarn = pointsToEarn,
                MaxRedeemablePoints = maxRedeemable,
                MaxDiscountAmount = maxRedeemable * settings.PointValue,
                CurrentBalance = currentBalance,
                PointValue = settings.PointValue
            };
        }

        // ===================================
        // RedeemPointsAsync
        // ===================================
        public async Task<RedeemPointsResultDto> RedeemPointsAsync(Guid userId, RedeemPointsDto dto)
        {
            var settings = await GetSettingsEntityAsync();
            if (!settings.IsActive)
                throw new Exception("نظام النقاط غير مفعّل حالياً");

            var account = await EnsureAccountAsync(userId);

            // التحقق من الحد الأدنى
            if (dto.Points < settings.MinRedemptionPoints)
                throw new Exception($"الحد الأدنى للاسترداد هو {settings.MinRedemptionPoints} نقطة");

            // التحقق من الرصيد
            if (dto.Points > account.Balance)
                throw new Exception($"رصيد النقاط غير كافٍ. رصيدك الحالي: {account.Balance}");

            // التحقق من الطلب
            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.Id == dto.OrderId && o.CustomerId == userId);
            if (order == null)
                throw new Exception("الطلب غير موجود");

            // التحقق أنه لم يتم استرداد نقاط لهذا الطلب من قبل
            var alreadyRedeemed = await _context.LoyaltyTransactions
                .AnyAsync(t => t.OrderId == dto.OrderId && t.Type == LoyaltyTransactionType.Redeemed);
            if (alreadyRedeemed)
                throw new Exception("تم استخدام نقاط لهذا الطلب مسبقاً");

            // التحقق من الحد الأقصى كنسبة من الطلب
            var maxDiscount = order.TotalAmount * (settings.MaxRedemptionPercentage / 100m);
            var requestedDiscount = dto.Points * settings.PointValue;

            int pointsToUse;
            decimal discountAmount;

            if (requestedDiscount > maxDiscount)
            {
                discountAmount = maxDiscount;
                pointsToUse = (int)Math.Ceiling(maxDiscount / settings.PointValue);
            }
            else
            {
                discountAmount = requestedDiscount;
                pointsToUse = dto.Points;
            }

            // تطبيق الخصم على الطلب
            order.DiscountAmount += discountAmount;
            order.TotalAmount -= discountAmount;
            if (order.TotalAmount < 0) order.TotalAmount = 0;

            // خصم النقاط
            account.Balance -= pointsToUse;
            account.TotalRedeemed += pointsToUse;
            account.UpdatedAt = DateTime.UtcNow;

            var transaction = new LoyaltyTransaction
            {
                AccountId = account.Id,
                Type = LoyaltyTransactionType.Redeemed,
                Points = -pointsToUse,
                BalanceAfter = account.Balance,
                Description = $"استرداد {pointsToUse} نقطة على الطلب — خصم {discountAmount:F2}",
                DescriptionAr = $"استرداد {pointsToUse} نقطة على الطلب — خصم {discountAmount:F2}",
                OrderId = dto.OrderId
            };

            await _context.LoyaltyTransactions.AddAsync(transaction);
            await _context.SaveChangesAsync();

            return new RedeemPointsResultDto
            {
                PointsUsed = pointsToUse,
                DiscountAmount = discountAmount,
                RemainingBalance = account.Balance,
                Message = $"تم خصم {discountAmount:F2} من قيمة طلبك"
            };
        }

        // ===================================
        // CancelRedemptionAsync — إعادة النقاط عند الإلغاء
        // ===================================
        public async Task CancelRedemptionAsync(Guid orderId)
        {
            var redemption = await _context.LoyaltyTransactions
                .Include(t => t.Account)
                .FirstOrDefaultAsync(t => t.OrderId == orderId && t.Type == LoyaltyTransactionType.Redeemed);

            if (redemption == null) return;
            // أُعيدت مسبقاً (إلغاء متكرر أو إلغاء آخر متجر بعد إلغاء الطلب)
            if (await _context.LoyaltyTransactions.AnyAsync(t => t.OrderId == orderId && t.Type == LoyaltyTransactionType.Adjusted
                    && t.Points > 0 && t.Description == "إعادة نقاط بسبب إلغاء الطلب"))
                return;

            var pointsToReturn = Math.Abs(redemption.Points);
            redemption.Account.Balance += pointsToReturn;
            redemption.Account.TotalRedeemed -= pointsToReturn;
            if (redemption.Account.TotalRedeemed < 0)
                redemption.Account.TotalRedeemed = 0;
            redemption.Account.UpdatedAt = DateTime.UtcNow;

            var refundTransaction = new LoyaltyTransaction
            {
                AccountId = redemption.AccountId,
                Type = LoyaltyTransactionType.Adjusted,
                Points = pointsToReturn,
                BalanceAfter = redemption.Account.Balance,
                Description = "إعادة نقاط بسبب إلغاء الطلب",
                DescriptionAr = "إعادة نقاط بسبب إلغاء الطلب",
                OrderId = orderId
            };

            await _context.LoyaltyTransactions.AddAsync(refundTransaction);
            await _context.SaveChangesAsync();
        }

        // ===================================
        // AdminAdjustPointsAsync
        // ===================================
        public async Task<LoyaltyAccountDto> AdminAdjustPointsAsync(AdminAdjustPointsDto dto)
        {
            var account = await EnsureAccountAsync(dto.UserId);
            var settings = await GetSettingsEntityAsync();

            var newBalance = account.Balance + dto.Points;
            if (newBalance < 0)
                throw new Exception("لا يمكن أن يصبح الرصيد سالباً");

            account.Balance = newBalance;
            if (dto.Points > 0)
                account.TotalEarned += dto.Points;
            else
                account.TotalRedeemed += Math.Abs(dto.Points);

            account.UpdatedAt = DateTime.UtcNow;

            var transaction = new LoyaltyTransaction
            {
                AccountId = account.Id,
                Type = LoyaltyTransactionType.Adjusted,
                Points = dto.Points,
                BalanceAfter = account.Balance,
                Description = dto.Reason,
                DescriptionAr = dto.ReasonAr ?? dto.Reason
            };

            await _context.LoyaltyTransactions.AddAsync(transaction);
            await _context.SaveChangesAsync();

            return MapToDto(account, settings);
        }

        // ===================================
        // GetSettingsAsync
        // ===================================
        public async Task<LoyaltySettingsDto> GetSettingsAsync()
        {
            var settings = await GetSettingsEntityAsync();
            return MapSettingsToDto(settings);
        }

        // ===================================
        // UpdateSettingsAsync
        // ===================================
        public async Task<LoyaltySettingsDto> UpdateSettingsAsync(UpdateLoyaltySettingsDto dto)
        {
            var settings = await GetSettingsEntityAsync();

            if (dto.PointsPerCurrencyUnit != null) settings.PointsPerCurrencyUnit = dto.PointsPerCurrencyUnit.Value;
            if (dto.PointValue != null) settings.PointValue = dto.PointValue.Value;
            if (dto.MinRedemptionPoints != null) settings.MinRedemptionPoints = dto.MinRedemptionPoints.Value;
            if (dto.MaxRedemptionPercentage != null) settings.MaxRedemptionPercentage = dto.MaxRedemptionPercentage.Value;
            if (dto.PointsExpiryDays != null) settings.PointsExpiryDays = dto.PointsExpiryDays.Value;
            if (dto.SilverThreshold != null) settings.SilverThreshold = dto.SilverThreshold.Value;
            if (dto.GoldThreshold != null) settings.GoldThreshold = dto.GoldThreshold.Value;
            if (dto.PlatinumThreshold != null) settings.PlatinumThreshold = dto.PlatinumThreshold.Value;
            if (dto.SilverMultiplier != null) settings.SilverMultiplier = dto.SilverMultiplier.Value;
            if (dto.GoldMultiplier != null) settings.GoldMultiplier = dto.GoldMultiplier.Value;
            if (dto.PlatinumMultiplier != null) settings.PlatinumMultiplier = dto.PlatinumMultiplier.Value;
            if (dto.ReviewPoints != null) settings.ReviewPoints = dto.ReviewPoints.Value;
            if (dto.IsActive != null) settings.IsActive = dto.IsActive.Value;

            settings.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapSettingsToDto(settings);
        }

        // ===================================
        // Private Helpers
        // ===================================
        private async Task<LoyaltyAccount> EnsureAccountAsync(Guid userId)
        {
            var account = await _context.LoyaltyAccounts
                .FirstOrDefaultAsync(a => a.UserId == userId);

            if (account == null)
            {
                account = new LoyaltyAccount { UserId = userId };
                await _context.LoyaltyAccounts.AddAsync(account);
                await _context.SaveChangesAsync();
            }

            return account;
        }

        private async Task<LoyaltySettings> GetSettingsEntityAsync()
        {
            var settings = await _context.LoyaltySettings.FirstOrDefaultAsync();
            if (settings == null)
            {
                settings = new LoyaltySettings();
                await _context.LoyaltySettings.AddAsync(settings);
                await _context.SaveChangesAsync();
            }
            return settings;
        }

        private static string CalculateTier(int totalEarned, LoyaltySettings settings)
        {
            if (totalEarned >= settings.PlatinumThreshold) return LoyaltyTier.Platinum;
            if (totalEarned >= settings.GoldThreshold) return LoyaltyTier.Gold;
            if (totalEarned >= settings.SilverThreshold) return LoyaltyTier.Silver;
            return LoyaltyTier.Bronze;
        }

        private static decimal GetTierMultiplier(string tier, LoyaltySettings settings) => tier switch
        {
            LoyaltyTier.Platinum => settings.PlatinumMultiplier,
            LoyaltyTier.Gold => settings.GoldMultiplier,
            LoyaltyTier.Silver => settings.SilverMultiplier,
            _ => 1.0m
        };

        private static string GetTierAr(string tier) => tier switch
        {
            LoyaltyTier.Platinum => "بلاتيني",
            LoyaltyTier.Gold => "ذهبي",
            LoyaltyTier.Silver => "فضي",
            _ => "برونزي"
        };

        private static string GetTransactionTypeAr(string type) => type switch
        {
            LoyaltyTransactionType.Earned => "نقاط مكتسبة",
            LoyaltyTransactionType.Redeemed => "نقاط مستردة",
            LoyaltyTransactionType.Expired => "نقاط منتهية الصلاحية",
            LoyaltyTransactionType.Adjusted => "تعديل يدوي",
            _ => type
        };

        private static LoyaltyAccountDto MapToDto(LoyaltyAccount account, LoyaltySettings settings)
        {
            var multiplier = GetTierMultiplier(account.Tier, settings);

            // حساب النقاط للمستوى التالي
            int nextThreshold = account.Tier switch
            {
                LoyaltyTier.Bronze => settings.SilverThreshold,
                LoyaltyTier.Silver => settings.GoldThreshold,
                LoyaltyTier.Gold => settings.PlatinumThreshold,
                _ => 0
            };

            string? nextTier = account.Tier switch
            {
                LoyaltyTier.Bronze => LoyaltyTier.Silver,
                LoyaltyTier.Silver => LoyaltyTier.Gold,
                LoyaltyTier.Gold => LoyaltyTier.Platinum,
                _ => null
            };

            return new LoyaltyAccountDto
            {
                Id = account.Id,
                Balance = account.Balance,
                TotalEarned = account.TotalEarned,
                TotalRedeemed = account.TotalRedeemed,
                Tier = account.Tier,
                TierAr = GetTierAr(account.Tier),
                BalanceValue = account.Balance * settings.PointValue,
                NextTierPoints = nextThreshold > 0 ? Math.Max(0, nextThreshold - account.TotalEarned) : 0,
                NextTier = nextTier,
                TierMultiplier = multiplier
            };
        }

        private static LoyaltyTransactionDto MapTransactionToDto(LoyaltyTransaction t) => new()
        {
            Id = t.Id,
            Type = t.Type,
            TypeAr = GetTransactionTypeAr(t.Type),
            Points = t.Points,
            BalanceAfter = t.BalanceAfter,
            Description = t.Description,
            DescriptionAr = t.DescriptionAr,
            OrderId = t.OrderId,
            OrderNumber = t.Order?.OrderNumber,
            ExpiresAt = t.ExpiresAt,
            CreatedAt = t.CreatedAt
        };

        private static LoyaltySettingsDto MapSettingsToDto(LoyaltySettings s) => new()
        {
            PointsPerCurrencyUnit = s.PointsPerCurrencyUnit,
            PointValue = s.PointValue,
            MinRedemptionPoints = s.MinRedemptionPoints,
            MaxRedemptionPercentage = s.MaxRedemptionPercentage,
            PointsExpiryDays = s.PointsExpiryDays,
            SilverThreshold = s.SilverThreshold,
            GoldThreshold = s.GoldThreshold,
            PlatinumThreshold = s.PlatinumThreshold,
            SilverMultiplier = s.SilverMultiplier,
            GoldMultiplier = s.GoldMultiplier,
            PlatinumMultiplier = s.PlatinumMultiplier,
            ReviewPoints = s.ReviewPoints,
            IsActive = s.IsActive
        };
    }
}
