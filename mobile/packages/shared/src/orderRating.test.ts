import { api } from './api';
import { reorderLines } from './cart';
import {
  canRateOrder,
  createOrderRating,
  pendingRatings,
  rateStoresAndDrivers,
  validateOrderRating,
} from './orderRating';

jest.mock('./api', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));

const post = api.post as jest.Mock;
const sub = (id: string, status: string, driverId?: string) => ({ id, status, driverId });
const none = { hasRated: false, ratedSubOrderIds: [], ratedDriverIds: [] };

describe('ما بقي بلا تقييم', () => {
  const subs = [sub('s1', 'DELIVERED', 'd1'), sub('s2', 'DELIVERED', 'd1'), sub('s3', 'CANCELLED', 'd2')];

  it('المسلَّم فقط، والسائق مرة واحدة', () => {
    expect(pendingRatings(subs, none)).toEqual({ subOrderIds: ['s1', 's2'], driverIds: ['d1'] });
  });

  it('يستثني ما قُيّم', () => {
    expect(pendingRatings(subs, { hasRated: true, ratedSubOrderIds: ['s1'], ratedDriverIds: ['d1'] })).toEqual({
      subOrderIds: ['s2'],
      driverIds: [],
    });
  });

  it('canRateOrder: قبل التقييم أو عند بقاء متجر أو سائق', () => {
    expect(canRateOrder(subs, undefined)).toBe(false);
    expect(canRateOrder(subs, none)).toBe(true);
    expect(canRateOrder(subs, { hasRated: true, ratedSubOrderIds: ['s1', 's2'], ratedDriverIds: ['d1'] })).toBe(false);
    expect(canRateOrder(subs, { hasRated: true, ratedSubOrderIds: ['s1'], ratedDriverIds: ['d1'] })).toBe(true);
  });

  it('التحقق', () => {
    expect(validateOrderRating(0)).toBeTruthy();
    expect(validateOrderRating(4)).toBeUndefined();
  });
});

describe('الإرسال', () => {
  beforeEach(() => post.mockReset().mockResolvedValue({ data: { success: true } }));

  it('التجربة كاملة بالمتاجر والسائقين وبلا الحقول الفارغة', async () => {
    await createOrderRating('o1', {
      deliveryRating: 5,
      deliveryComment: '  ',
      speedRating: 4,
      wouldRecommend: true,
      storeRatings: [{ subOrderId: 's1', vendorRating: 5, vendorComment: ' ممتاز ' }],
      driverRatings: [{ driverId: 'd1', rating: 5 }],
    });
    const [url, body] = post.mock.calls[0];
    expect(url).toContain('o1');
    expect(body.deliveryComment).toBeUndefined();
    expect(body.packagingRating).toBeUndefined();
    expect(body.subOrderRatings[0].vendorComment).toBe('ممتاز');
    expect(body.driverRatings).toEqual([{ driverId: 'd1', rating: 5 }]);
  });

  it('المتاجر والسائقون وحدهم', async () => {
    await rateStoresAndDrivers('o1', { storeRatings: [{ subOrderId: 's2', vendorRating: 3 }], driverRatings: [] });
    expect(post.mock.calls[0][0]).toContain('stores');
  });
});

describe('إعادة الطلب', () => {
  it('يضيف كل سطر ويبلّغ عن الفاشل دون إيقاف الباقي', async () => {
    post
      .mockReset()
      .mockResolvedValueOnce({ data: { data: {} } })
      .mockRejectedValueOnce({ message: 'نفد المخزون' })
      .mockResolvedValueOnce({ data: { data: {} } });

    const result = await reorderLines([
      { productId: 'a', quantity: 1, name: 'أ' },
      { productId: 'b', variantId: 'v', quantity: 2, name: 'ب' },
      { productId: 'c', quantity: 500, name: 'ج' },
    ]);

    expect(result.added).toBe(2);
    expect(result.failed).toEqual([{ name: 'ب', message: 'نفد المخزون' }]);
    expect(post.mock.calls[2][1].quantity).toBe(100);
  });
});
