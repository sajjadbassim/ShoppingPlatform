import { api } from './api';
import {
  fetchLoyaltyTransactions,
  referralShareText,
  tierProgress,
  toggleWishlist,
  withoutWishlistProduct,
  wishlistToSummary,
  type WishlistItem,
} from './engagement';

jest.mock('./api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

const item: WishlistItem = {
  id: 'w1',
  productId: 'p1',
  createdAt: '2026-10-20T00:00:00Z',
  product: {
    id: 'p1', name: 'Phone', nameAr: 'هاتف', price: 1000, originalPrice: 1200, isAvailable: true,
    stockQuantity: 3, primaryImageUrl: '/uploads/a.jpg', vendorId: 'v1', vendorName: 'متجر', hasDiscount: true, discountPercentage: 16.67,
  },
};

describe('المفضلة', () => {
  it('التبديل يعيد الحالة الجديدة من الخادم', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { success: true, isInWishlist: true } });
    await expect(toggleWishlist('p1')).resolves.toBe(true);
    expect((api.post as jest.Mock).mock.calls[0][1]).toEqual({ productId: 'p1' });
  });

  it('تحويل العنصر إلى بطاقة منتج', () => {
    expect(wishlistToSummary(item)).toMatchObject({ id: 'p1', nameAr: 'هاتف', price: 1000, vendorId: 'v1', hasDiscount: true });
  });

  it('إزالة منتج من القائمة المحلية', () => {
    expect(withoutWishlistProduct([item], 'p1')).toEqual([]);
    expect(withoutWishlistProduct([item], 'other')).toHaveLength(1);
  });
});

describe('الولاء', () => {
  it('تقدّم المستوى', () => {
    expect(tierProgress({ totalEarned: 300, nextTierPoints: 700, nextTier: 'GOLD' })).toBeCloseTo(0.3);
    expect(tierProgress({ totalEarned: 5000, nextTierPoints: 0, nextTier: null })).toBeNull();
    expect(tierProgress({ totalEarned: 0, nextTierPoints: 500, nextTier: 'SILVER' })).toBe(0);
  });

  it('نص الدعوة يحوي الرمز والنقاط', () => {
    const text = referralShareText({ code: 'ABC123', rewardPoints: 500 });
    expect(text).toContain('ABC123');
    expect(text).toContain('500');
  });

  it('سجل المعاملات بالترقيم', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { data: [{ id: 't1' }], pagination: { currentPage: 1, hasNext: true } } });
    const page = await fetchLoyaltyTransactions(1);
    expect((api.get as jest.Mock).mock.calls[0][1]).toEqual({ params: { pageNumber: 1, pageSize: 20 } });
    expect(page.pagination.hasNext).toBe(true);
  });
});
