import { createAddress, formatAddress, hasPin, validateAddress } from './addresses';
import { api } from './api';
import {
  computeCheckoutTotals,
  createOrder,
  groupSlotsByDay,
  redeemBase,
  validateCoupon,
  type DeliverySlot,
} from './orders';

jest.mock('./api', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));

const post = api.post as jest.Mock;

describe('العناوين', () => {
  const valid = { label: 'علي', phone: '0770 123 4567', city: 'بغداد', area: 'الكرادة', streetAddress: 'شارع 1' };

  it('الدبوس إلزامي', () => {
    expect(validateAddress(valid, null).pin).toBeTruthy();
    expect(validateAddress(valid, { latitude: 33.3, longitude: 44.4 })).toEqual({});
  });

  it('حقول ناقصة ورقم غير صالح', () => {
    const errors = validateAddress({ label: '', phone: '123', city: '', area: ' ', streetAddress: '' }, null);
    expect(Object.keys(errors).sort()).toEqual(['area', 'city', 'label', 'phone', 'pin', 'streetAddress']);
  });

  it('الإنشاء يربط المستخدم ويطبّع الهاتف', async () => {
    post.mockResolvedValue({ data: { data: { id: 'a1' } } });
    await createAddress('u1', { ...valid, latitude: 33.3, longitude: 44.4 });
    expect(post.mock.calls[0][1]).toMatchObject({ userId: 'u1', phone: '07701234567', latitude: 33.3, floorNumber: '' });
  });

  it('الدبوس والنص', () => {
    expect(hasPin({ latitude: 0, longitude: 0 })).toBe(true);
    expect(hasPin({ latitude: null, longitude: 44 })).toBe(false);
    expect(formatAddress({ city: 'بغداد', area: 'الكرادة', streetAddress: 'شارع 1', buildingNumber: '5' })).toBe(
      'بغداد، الكرادة، شارع 1، بناية 5',
    );
  });
});

describe('الإجماليات', () => {
  it('الكوبون والنقاط يخصمان من المجموع مع التوصيل', () => {
    const t = computeCheckoutTotals({ subtotal: 50000, deliveryFees: 3000, couponDiscount: 5000, pointsToRedeem: 100, pointValue: 5, earnRate: 0.01 });
    expect(t.pointsDiscount).toBe(500);
    expect(t.total).toBe(47500);
    // النقاط المكتسبة على (50000 - 5000 - 500) بلا التوصيل
    expect(t.pointsToEarn).toBe(445);
  });

  it('الإجمالي لا ينزل تحت الصفر', () => {
    expect(computeCheckoutTotals({ subtotal: 1000, deliveryFees: 0, couponDiscount: 5000, pointsToRedeem: 0, pointValue: 5 }).total).toBe(0);
  });

  it('أساس الصرف', () => {
    expect(redeemBase(50000, 3000, 5000)).toBe(48000);
    expect(redeemBase(1000, 0, 5000)).toBe(0);
  });
});

describe('الكوبون والطلب', () => {
  beforeEach(() => post.mockReset());

  it('كوبون صالح', async () => {
    post.mockResolvedValue({ data: { data: { isValid: true, code: 'X', discountAmount: 1000, finalAmount: 9000 } } });
    await expect(validateCoupon(' X ', 10000)).resolves.toMatchObject({ code: 'X', discountAmount: 1000 });
    expect(post.mock.calls[0][1]).toEqual({ code: 'X', orderAmount: 10000 });
  });

  it('كوبون غير صالح يرمي رسالة الخادم', async () => {
    post.mockResolvedValue({ data: { data: { isValid: false, errorMessage: 'انتهى الكوبون' } } });
    await expect(validateCoupon('X', 10000)).rejects.toMatchObject({ message: 'انتهى الكوبون' });
  });

  it('إنشاء الطلب يرسل العنوان والموعد والاستبدال', async () => {
    post.mockResolvedValue({ data: { data: { id: 'o1', orderNumber: 'ORD-1' } } });
    const order = await createOrder({ addressId: 'a1', deliverySlotStart: '2026-10-21T07:00:00Z', substitutionPreference: 'SIMILAR' });
    expect(order.orderNumber).toBe('ORD-1');
    expect(post.mock.calls[0][1]).toEqual({ addressId: 'a1', deliverySlotStart: '2026-10-21T07:00:00Z', substitutionPreference: 'SIMILAR' });
  });
});

describe('groupSlotsByDay', () => {
  const slot = (dayLabel: string, timeLabel: string): DeliverySlot => ({ start: '', end: '', dayLabel, timeLabel });

  it('يجمع المواعيد بحسب اليوم بترتيب ظهورها', () => {
    const days = groupSlotsByDay([slot('اليوم', 'a'), slot('غداً', 'b'), slot('غداً', 'c')]);
    expect(days.map((d) => [d.label, d.slots.length])).toEqual([['اليوم', 1], ['غداً', 2]]);
  });
});

import { vendorUsesZones } from './orders';

describe('vendorUsesZones', () => {
  it('معطّلة', () => expect(vendorUsesZones({ enabled: false, mode: 'OFF', vendorIds: [] }, 'v')).toBe(false));
  it('كل المتاجر', () => expect(vendorUsesZones({ enabled: true, mode: 'ALL', vendorIds: [] }, 'v')).toBe(true));
  it('متاجر محددة', () => {
    const config = { enabled: true, mode: 'SELECTED', vendorIds: ['a'] };
    expect(vendorUsesZones(config, 'a')).toBe(true);
    expect(vendorUsesZones(config, 'b')).toBe(false);
  });
  it('بلا إعداد', () => expect(vendorUsesZones(undefined, 'v')).toBe(false));
});
