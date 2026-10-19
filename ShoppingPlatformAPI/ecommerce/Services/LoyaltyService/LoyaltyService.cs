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

            await using var loyaltyLock = await OrderLock.ForLoyaltyAsync(_context, userId);
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
                Description = $"نقاط مكتسبة من الطلب — قيمة {orderAmount:N0} د.ع",
                DescriptionAr = $"نقاط مكتسبة من الطلب — قيمة {orderAmount:N0} د.ع",
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
                Description = "نقاط مكتسبة من كتابة تقييم",
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
                PointValue = settings.PointValue,
                EarnRate = settings.PointsPerCurrencyUnit * multiplier,
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

            if (dto.Points < settings.MinRedemptionPoints)
                throw new BusinessRuleException($"الحد الأدنى للاسترداد هو {settings.MinRedemptionPoints} نقطة");

            // طلبان متزامنان (نقرتان، تبويبان): الطلب ثم حساب النقاط — نفس الترتيب دائماً، والقراءة بعد القفل
            await using var orderLock = await OrderLock.ForOrderAsync(_context, dto.OrderId);
            await using var loyaltyLock = await OrderLock.ForLoyaltyAsync(_context, userId);

            var order = await _context.Orders.Include(o => o.SubOrders)
                .FirstOrDefaultAsync(o => o.Id == dto.OrderId && o.CustomerId == userId);
            if (order == null)
                throw new NotFoundException("الطلب غير موجود");

            // الخصم يغيّر المبلغ المطلوب: يُسمح به قبل خروج الطلب مع السائق فقط — لا على ملغى ولا على ما سُلّم ودُفع
            var redeemable = new[] { OrderStatus.PENDING_CONFIRMATION, OrderStatus.PARTIALLY_CONFIRMED, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY };
            if (!redeemable.Contains(order.Status) || order.PaymentStatus == PaymentStatus.Paid)
                throw new BusinessRuleException($"لا يمكن استخدام النقاط على طلب «{OrderStatusText.Ar(order.Status)}»");
            // الخصم يُحمَّل على الأجزاء التي لم تخرج مع السائق بعد
            var open = order.SubOrders.Where(s => s.Status != OrderStatus.CANCELLED && !OrderTotals.IsFrozen(s)).ToList();
            if (open.Count == 0)
                throw new BusinessRuleException("خرج طلبك مع السائق — لا يمكن استخدام النقاط عليه الآن");

            if (await _context.LoyaltyTransactions.AnyAsync(t => t.OrderId == dto.OrderId && t.Type == LoyaltyTransactionType.Redeemed))
                throw new BusinessRuleException("تم استخدام نقاط لهذا الطلب مسبقاً");

            var account = await EnsureAccountAsync(userId);
            if (dto.Points > account.Balance)
                throw new BusinessRuleException($"رصيد النقاط غير كافٍ. رصيدك الحالي: {account.Balance}");

            // الحد الأقصى كنسبة مما بقي على الأجزاء المفتوحة
            var maxDiscount = Math.Round(open.Sum(OrderTotals.DueFor) * (settings.MaxRedemptionPercentage / 100m), 2);
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
            if (pointsToUse <= 0 || discountAmount <= 0)
                throw new BusinessRuleException("لا يمكن استخدام نقاط على هذا الطلب");

            // الخصم تتحمّله المنصة لا المتجر، ويُوزَّع على الأجزاء المفتوحة
            order.PointsRedeemedAmount += discountAmount;
            OrderTotals.SpreadPoints(order, order.SubOrders, discountAmount);
            OrderTotals.Recalculate(order, order.SubOrders);

            account.Balance -= pointsToUse;
            account.TotalRedeemed += pointsToUse;
            account.UpdatedAt = DateTime.UtcNow;

            var transaction = new LoyaltyTransaction
            {
                AccountId = account.Id,
                Type = LoyaltyTransactionType.Redeemed,
                Points = -pointsToUse,
                BalanceAfter = account.Balance,
                Description = $"استرداد {pointsToUse} نقطة على الطلب — خصم {discountAmount:N0} د.ع",
                DescriptionAr = $"استرداد {pointsToUse} نقطة على الطلب — خصم {discountAmount:N0} د.ع",
                OrderId = dto.OrderId,
                ReferenceKey = $"redeem:{dto.OrderId}"
            };

            await _context.LoyaltyTransactions.AddAsync(transaction);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 })
            {
                throw new BusinessRuleException("تم استخدام نقاط لهذا الطلب مسبقاً");
            }

            return new RedeemPointsResultDto
            {
                PointsUsed = pointsToUse,
                DiscountAmount = discountAmount,
                RemainingBalance = account.Balance,
                Message = $"تم خصم {discountAmount:N0} د.ع من قيمة طلبك"
            };
        }

        // ===================================
        // CancelRedemptionAsync — إلغاء الطلب كله: تُعاد كل النقاط المستبدلة عليه (ناقص ما أُعيد سابقاً)
        // ===================================
        public async Task CancelRedemptionAsync(Guid orderId)
        {
            var customerId = await _context.Orders.Where(o => o.Id == orderId).Select(o => (Guid?)o.CustomerId).FirstOrDefaultAsync();
            if (customerId == null) return;
            await using var loyaltyLock = await OrderLock.ForLoyaltyAsync(_context, customerId.Value);

            var refundKey = $"redeem-cancel:{orderId}";
            var txs = await _context.LoyaltyTransactions.AsNoTracking()
                .Where(t => t.OrderId == orderId && (t.Type == LoyaltyTransactionType.Redeemed
                    || t.Type == LoyaltyTransactionType.Adjusted && t.ReferenceKey != null && t.ReferenceKey.StartsWith("redeem-")))
                .ToListAsync();
            if (!txs.Any(t => t.Type == LoyaltyTransactionType.Redeemed) || txs.Any(t => t.ReferenceKey == refundKey)) return;
            // السجلات القديمة: إعادة بلا مفتاح بنفس الوصف
            if (await _context.LoyaltyTransactions.AnyAsync(t => t.OrderId == orderId && t.Type == LoyaltyTransactionType.Adjusted
                    && t.Points > 0 && t.ReferenceKey == null && t.Description == "إعادة نقاط بسبب إلغاء الطلب"))
                return;

            var pointsToReturn = -txs.Where(t => t.Type == LoyaltyTransactionType.Redeemed).Sum(t => t.Points)
                                 - txs.Where(t => t.Type == LoyaltyTransactionType.Adjusted).Sum(t => t.Points);
            if (pointsToReturn <= 0) return;

            await RefundPointsAsync(customerId.Value, orderId, pointsToReturn, refundKey, "إعادة نقاط بسبب إلغاء الطلب");
        }

        // ===================================
        // RefundUnusedPointsAsync — سقط جزء يحمل خصم نقاط (أو أزال المتجر قطعاً منه): نصيبه لا ينتقل لجزء آخر،
        // يُعاد للزبون نقاطاً. يُستدعى بعد OrderTotals.Recalculate وحفظه
        // ===================================
        public async Task RefundUnusedPointsAsync(Guid orderId)
        {
            var customerId = await _context.Orders.Where(o => o.Id == orderId).Select(o => (Guid?)o.CustomerId).FirstOrDefaultAsync();
            if (customerId == null) return;
            await using var loyaltyLock = await OrderLock.ForLoyaltyAsync(_context, customerId.Value);

            var order = await _context.Orders.FirstAsync(o => o.Id == orderId);
            if (order.Status == OrderStatus.CANCELLED) return;   // الإلغاء الكامل يعيد كل شيء عبر CancelRedemptionAsync
            var unused = OrderTotals.UnusedPoints(order);
            if (unused <= 0) return;

            var settings = await GetSettingsEntityAsync();
            var points = settings.PointValue > 0 ? (int)Math.Floor(unused / settings.PointValue) : 0;
            order.PointsRedeemedAmount = order.PointsDiscountAmount;
            if (points <= 0) { await _context.SaveChangesAsync(); return; }

            await RefundPointsAsync(customerId.Value, orderId, points, $"redeem-unused:{orderId}:{DateTime.UtcNow.Ticks}",
                "إعادة نقاط جزء أُلغي من الطلب");
        }

        private async Task RefundPointsAsync(Guid userId, Guid orderId, int points, string referenceKey, string description)
        {
            var account = await EnsureAccountAsync(userId);
            account.Balance += points;
            account.TotalRedeemed = Math.Max(0, account.TotalRedeemed - points);
            account.UpdatedAt = DateTime.UtcNow;

            _context.LoyaltyTransactions.Add(new LoyaltyTransaction
            {
                AccountId = account.Id,
                Type = LoyaltyTransactionType.Adjusted,
                Points = points,
                BalanceAfter = account.Balance,
                Description = description,
                DescriptionAr = description,
                OrderId = orderId,
                ReferenceKey = referenceKey,
            });
            await _context.SaveChangesAsync();
        }

        // ===================================
        // ReverseReturnPointsAsync — قبول إرجاع بعد الاستلام: قيد عكسي يخصم نقاط القطع المُرجعة
        // من نقاط طلبها الفرعي بنسبة قيمتها (النقاط مُنحت على ما دُفع بعد الخصم، والنسبة تحفظ ذلك).
        // مرة واحدة لكل إرجاع. الرصيد لا يصبح سالباً: ما صرفه الزبون من هذه النقاط يُعاد كقيمة (Shortfall)
        // يخصمها المتصل من مبلغ الاسترجاع
        // ===================================
        public async Task<ReturnPointsReversal> ReverseReturnPointsAsync(Guid returnId)
        {
            var referenceKey = $"return:{returnId}";
            if (await _context.LoyaltyTransactions.AnyAsync(t => t.ReferenceKey == referenceKey)) return ReturnPointsReversal.None;

            var ret = await _context.Returns.AsNoTracking().Include(r => r.Items)
                .FirstOrDefaultAsync(r => r.Id == returnId);
            if (ret == null || ret.IsDoorRefusal) return ReturnPointsReversal.None;   // الرفض عند الباب لم تُمنح عليه نقاط أصلاً

            var subOrders = await _context.SubOrders.AsNoTracking().Include(so => so.Items)
                .Where(so => so.OrderId == ret.OrderId && so.Status == OrderStatus.DELIVERED).ToListAsync();
            var earnedKeys = subOrders.Select(so => $"suborder:{so.Id}").ToList();
            var earned = await _context.LoyaltyTransactions.AsNoTracking()
                .Where(t => t.Type == LoyaltyTransactionType.Earned && t.ReferenceKey != null && earnedKeys.Contains(t.ReferenceKey))
                .ToDictionaryAsync(t => t.ReferenceKey!, t => t.Points);

            var points = 0m;
            foreach (var item in ret.Items)
            {
                var so = subOrders.FirstOrDefault(s => s.Items.Any(i => i.ProductId == item.ProductId && i.VariantId == item.VariantId));
                if (so == null || !earned.TryGetValue($"suborder:{so.Id}", out var soPoints)) continue;
                var soValue = so.Items.Sum(i => i.UnitPrice * (i.Quantity - i.RefusedQuantity));
                if (soValue <= 0) continue;
                points += soPoints * Math.Min(1m, item.UnitPrice * item.Quantity / soValue);
            }

            await using var loyaltyLock = await OrderLock.ForLoyaltyAsync(_context, ret.CustomerId);
            var account = await _context.LoyaltyAccounts.FirstOrDefaultAsync(a => a.UserId == ret.CustomerId);
            if (account != null && _context.Entry(account).State == EntityState.Unchanged) await _context.Entry(account).ReloadAsync();
            var owed = (int)Math.Round(points);
            if (owed <= 0) return ReturnPointsReversal.None;
            var settings = await GetSettingsEntityAsync();
            var toDeduct = Math.Min(owed, Math.Max(0, account?.Balance ?? 0));
            var shortfall = owed - toDeduct;
            var result = new ReturnPointsReversal(toDeduct, shortfall, shortfall * settings.PointValue);
            if (account == null) return result;

            // النقاط مُنحت على قطع أُرجعت: تخرج كلها من «مجموع المكتسب» (المستوى) حتى ما صُرف منها —
            // المصروف تُخصم قيمته من مبلغ الاسترجاع، ويُسجَّل القيد في سجل الزبون حتى لو لم يُخصم من الرصيد شيء
            account.Balance -= toDeduct;
            account.TotalEarned = Math.Max(0, account.TotalEarned - owed);
            account.Tier = CalculateTier(account.TotalEarned, settings);
            account.UpdatedAt = DateTime.UtcNow;

            var text = $"خصم نقاط الإرجاع {ret.ReturnNumber}" + (shortfall > 0
                ? $" — {owed:N0} نقطة: {toDeduct:N0} من الرصيد، و{shortfall:N0} صُرفت سابقاً فخُصمت قيمتها ({result.ShortfallValue:N0} د.ع) من مبلغ الاسترجاع"
                : "");
            _context.LoyaltyTransactions.Add(new LoyaltyTransaction
            {
                AccountId = account.Id,
                Type = LoyaltyTransactionType.Adjusted,
                Points = -toDeduct,
                BalanceAfter = account.Balance,
                Description = text,
                DescriptionAr = text,
                OrderId = ret.OrderId,
                ReferenceKey = referenceKey,
            });
            await _context.SaveChangesAsync();
            return result;
        }

        // ===================================
        // AdminAdjustPointsAsync
        // ===================================
        public async Task<LoyaltyAccountDto> AdminAdjustPointsAsync(AdminAdjustPointsDto dto)
        {
            var role = await _context.Users.Where(u => u.Id == dto.UserId).Select(u => u.Role).FirstOrDefaultAsync()
                ?? throw new NotFoundException("المستخدم غير موجود");
            if (role != UserRoles.Customer)
                throw new BusinessRuleException("النقاط للزبائن فقط");

            await using var loyaltyLock = await OrderLock.ForLoyaltyAsync(_context, dto.UserId);
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
            // جسم فارغ {} كان يُقبل بـ200 ويحدّث updated_at دون تغيير شيء
            if (dto.GetType().GetProperties().All(p => p.GetValue(dto) == null))
                throw new BusinessRuleException("لم يُرسل أي إعداد للحفظ");

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
            // كيان متتبَّع من قبل في نفس الطلب قد يحمل رصيداً قديماً — يُقرأ من القاعدة (بعد قفل الحساب)
            if (account != null && _context.Entry(account).State == EntityState.Unchanged)
                await _context.Entry(account).ReloadAsync();

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

        // «تعديل» آلي (إعادة نقاط إلغاء، خصم نقاط إرجاع، دعوة، تقييم) له مفتاح مرجعي — اليدوي من الأدمن بلا مفتاح
        private static string GetTransactionTypeAr(LoyaltyTransaction t) => t.Type switch
        {
            LoyaltyTransactionType.Earned => "نقاط مكتسبة",
            LoyaltyTransactionType.Redeemed => "نقاط مستردة",
            LoyaltyTransactionType.Expired => "نقاط منتهية الصلاحية",
            LoyaltyTransactionType.Adjusted when t.ReferenceKey?.StartsWith("return:") == true => "خصم نقاط إرجاع",
            LoyaltyTransactionType.Adjusted when t.ReferenceKey?.StartsWith("redeem-") == true
                || t.ReferenceKey == null && t.Description == "إعادة نقاط بسبب إلغاء الطلب" => "إعادة نقاط",
            LoyaltyTransactionType.Adjusted when t.ReferenceKey != null => t.Points >= 0 ? "نقاط مكافأة" : "خصم نقاط",
            LoyaltyTransactionType.Adjusted => "تعديل من الإدارة",
            _ => t.Type
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
            TypeAr = GetTransactionTypeAr(t),
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
