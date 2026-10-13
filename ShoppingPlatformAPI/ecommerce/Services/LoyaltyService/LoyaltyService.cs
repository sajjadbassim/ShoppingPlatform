using ecommerce.Services.NotificationService;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Loyalty;
using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using ecommerce.Core.Exceptions;

namespace ecommerce.Services.LoyaltyService
{
    public class LoyaltyService : ILoyaltyService
    {
        private readonly AppDbContext _context;
        private readonly INotificationService? _notifications;

        public LoyaltyService(AppDbContext context, INotificationService? notifications = null)
        {
            _context = context;
            _notifications = notifications;
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
                throw new NotFoundException("حساب النقاط غير موجود");

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
        // EarnPointsAsync — يُستدعى عند تسليم كل طلب فرعي (OpsService)
        // كل متجر في الطلب يمنح نقاط قيمته مرة واحدة
        // ===================================
        public async Task EarnPointsAsync(Guid userId, Guid orderId, Guid subOrderId, decimal orderAmount)
        {
            var settings = await GetSettingsEntityAsync();
            if (!settings.IsActive) return;

            var account = await EnsureAccountAsync(userId);

            var referenceKey = $"suborder:{subOrderId}";
            // السجلات القديمة (بلا مفتاح) كانت تمنح نقاط الطلب مرة واحدة على مستوى الطلب كله
            var alreadyEarned = await _context.LoyaltyTransactions
                .AnyAsync(t => t.AccountId == account.Id && t.ReferenceKey == referenceKey
                    || t.OrderId == orderId && t.Type == LoyaltyTransactionType.Earned && t.ReferenceKey == null);
            if (alreadyEarned) return;

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
                ReferenceKey = referenceKey,
                ExpiresAt = expiresAt
            };

            await TrySaveEarnedAsync(account, transaction);

            // أول طلب يُسلَّم لمستخدم مدعو: مكافأة الدعوة للطرفين (فشلها لا يُفشل التسليم)
            try { await RewardReferralAsync(userId); }
            catch (Exception) { /* تُعاد المحاولة مع تسليم الطلب التالي */ }
        }

        // ===================================
        // ادعُ صديقاً
        // ===================================
        private const string ReferralAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        public async Task<ReferralInfoDto> GetReferralAsync(Guid userId)
        {
            var settings = await GetSettingsEntityAsync();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId)
                ?? throw new NotFoundException("المستخدم غير موجود");

            // الرمز يُنشأ عند أول طلب له، فريد (فهرس) — إعادة المحاولة عند تصادم نادر
            for (var attempt = 0; user.ReferralCode == null && attempt < 5; attempt++)
            {
                user.ReferralCode = new string(Enumerable.Range(0, 7)
                    .Select(_ => ReferralAlphabet[Random.Shared.Next(ReferralAlphabet.Length)]).ToArray());
                try { await _context.SaveChangesAsync(); }
                catch (DbUpdateException) { user.ReferralCode = null; }
            }

            var invited = await _context.Users.Where(u => u.ReferredByUserId == userId)
                .GroupBy(_ => 1)
                .Select(g => new { Total = g.Count(), Rewarded = g.Count(u => u.ReferralRewardedAt != null) })
                .FirstOrDefaultAsync();

            return new ReferralInfoDto
            {
                Code = user.ReferralCode ?? "",
                RewardPoints = settings.ReferralPoints,
                InvitedCount = invited?.Total ?? 0,
                RewardedCount = invited?.Rewarded ?? 0,
                Enabled = settings.IsActive && settings.ReferralPoints > 0,
            };
        }

        public async Task<Guid?> ResolveReferrerAsync(string? code)
        {
            if (string.IsNullOrWhiteSpace(code)) return null;
            var normalized = code.Trim().ToUpperInvariant();
            return await _context.Users
                .Where(u => u.ReferralCode == normalized && u.IsActive)
                .Select(u => (Guid?)u.Id)
                .FirstOrDefaultAsync();
        }

        public async Task<int> RewardReferralAsync(Guid inviteeId)
        {
            var settings = await GetSettingsEntityAsync();
            if (!settings.IsActive || settings.ReferralPoints <= 0) return 0;

            var invitee = await _context.Users.FirstOrDefaultAsync(u => u.Id == inviteeId);
            if (invitee?.ReferredByUserId == null || invitee.ReferralRewardedAt != null) return 0;
            var referrerId = invitee.ReferredByUserId.Value;
            if (referrerId == inviteeId || !await _context.Users.AnyAsync(u => u.Id == referrerId && u.IsActive)) return 0;

            // مفتاح لكل طرف مرتبط بالمدعو: الفهرس الفريد يمنع صرف المكافأة مرتين حتى مع تسليمين متزامنين
            var points = settings.ReferralPoints;
            var inviteeEarned = await CreditAsync(inviteeId, points, $"referral:{inviteeId}",
                "Referral reward — welcome bonus", "مكافأة الانضمام بدعوة صديق", settings);
            var referrerEarned = await CreditAsync(referrerId, points, $"referral-invite:{inviteeId}",
                "Referral reward — friend's first order", "مكافأة دعوة صديق أكمل أول طلب", settings);

            invitee.ReferralRewardedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            if (_notifications != null)
            {
                try
                {
                    if (referrerEarned)
                        await _notifications.NotifyCustomerReminderAsync(referrerId,
                            $"صديقك {invitee.FullName} أكمل أول طلب — أضفنا لك {points} نقطة 🎉", new { link = "/loyalty" });
                    if (inviteeEarned)
                        await _notifications.NotifyCustomerReminderAsync(inviteeId,
                            $"أضفنا لك {points} نقطة مكافأة انضمامك بدعوة صديق 🎉", new { link = "/loyalty" });
                }
                catch { /* الإشعار لا يُفشل المكافأة */ }
            }
            return points;
        }

        private async Task<bool> CreditAsync(Guid userId, int points, string referenceKey, string description, string descriptionAr,
            LoyaltySettings settings)
        {
            var account = await EnsureAccountAsync(userId);
            if (await _context.LoyaltyTransactions.AnyAsync(t => t.AccountId == account.Id && t.ReferenceKey == referenceKey))
                return false;

            account.Balance += points;
            account.TotalEarned += points;
            account.UpdatedAt = DateTime.UtcNow;
            account.Tier = CalculateTier(account.TotalEarned, settings);

            return await TrySaveEarnedAsync(account, new LoyaltyTransaction
            {
                AccountId = account.Id,
                Type = LoyaltyTransactionType.Earned,
                Points = points,
                BalanceAfter = account.Balance,
                Description = description,
                DescriptionAr = descriptionAr,
                ReferenceKey = referenceKey,
                ExpiresAt = settings.PointsExpiryDays > 0 ? DateTime.UtcNow.AddDays(settings.PointsExpiryDays) : null
            });
        }

        // الفحص المسبق قد يمرّ لطلبين متزامنين لنفس الحدث؛ الفهرس الفريد (الحساب، المفتاح) يرفض الثاني
        // فيُتجاهل بدل أن يُفشل العملية الأصلية (تسليم أو تقييم)
        private async Task<bool> TrySaveEarnedAsync(LoyaltyAccount account, LoyaltyTransaction transaction)
        {
            await _context.LoyaltyTransactions.AddAsync(transaction);
            try
            {
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 })
            {
                _context.Entry(transaction).State = EntityState.Detached;
                await _context.Entry(account).ReloadAsync();
                return false;
            }
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

            if (!await TrySaveEarnedAsync(account, transaction)) return 0;

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
                throw new BusinessRuleException("نظام النقاط غير مفعّل حالياً");

            var account = await EnsureAccountAsync(userId);

            // التحقق من الحد الأدنى
            if (dto.Points < settings.MinRedemptionPoints)
                throw new BusinessRuleException($"الحد الأدنى للاسترداد هو {settings.MinRedemptionPoints} نقطة");

            // التحقق من الرصيد
            if (dto.Points > account.Balance)
                throw new BusinessRuleException($"رصيد النقاط غير كافٍ. رصيدك الحالي: {account.Balance}");

            // التحقق من الطلب
            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.Id == dto.OrderId && o.CustomerId == userId);
            if (order == null)
                throw new NotFoundException("الطلب غير موجود");

            // الخصم يغيّر المبلغ المطلوب: يُسمح به قبل خروج الطلب مع السائق فقط — لا على ملغى ولا على ما سُلّم ودُفع
            var redeemable = new[] { OrderStatus.PENDING_CONFIRMATION, OrderStatus.PARTIALLY_CONFIRMED, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY };
            if (!redeemable.Contains(order.Status) || order.PaymentStatus == PaymentStatus.Paid)
                throw new BusinessRuleException($"لا يمكن استخدام النقاط على طلب «{OrderStatusText.Ar(order.Status)}»");

            // التحقق أنه لم يتم استرداد نقاط لهذا الطلب من قبل
            var alreadyRedeemed = await _context.LoyaltyTransactions
                .AnyAsync(t => t.OrderId == dto.OrderId && t.Type == LoyaltyTransactionType.Redeemed);
            if (alreadyRedeemed)
                throw new BusinessRuleException("تم استخدام نقاط لهذا الطلب مسبقاً");

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
            order.PointsDiscountAmount += discountAmount;   // تتحمّله المنصة لا المتجر
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
                throw new BusinessRuleException("لا يمكن أن يصبح الرصيد سالباً");

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
            if (dto.ReferralPoints != null) settings.ReferralPoints = dto.ReferralPoints.Value;
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
            ReferralPoints = s.ReferralPoints,
            IsActive = s.IsActive
        };
    }
}
