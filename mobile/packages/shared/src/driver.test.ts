import {
  canReceiveOrders,
  newestFirst,
  displayWorkStatus,
  mapsUrl,
  refusedValue,
  refusesAll,
  splitReturnTrips,
  type DriverOrder,
  type ReturnTrip,
} from './driver';

const item = (id: string, quantity: number, unitPrice: number, refusedQuantity = 0) => ({
  subOrderItemId: id, name: id, quantity, unitPrice, refusedQuantity,
});
const order = {
  orderId: 'o1',
  stores: [{ items: [item('a', 2, 1000), item('b', 1, 500)] }, { items: [item('c', 3, 250, 1)] }],
} as unknown as DriverOrder;

describe('driver helpers', () => {
  it('delivering يُعرض متاحاً ويستقبل الطلبات', () => {
    expect(displayWorkStatus('delivering')).toBe('available');
    expect(canReceiveOrders('delivering')).toBe(true);
    expect(canReceiveOrders('break')).toBe(false);
  });

  it('رابط الملاحة بالإحداثيات أو بالعنوان', () => {
    expect(mapsUrl({ latitude: 33.3, longitude: 44.4 })).toContain('destination=33.3,44.4');
    expect(mapsUrl({ address: 'الكرادة' })).toContain(encodeURIComponent('الكرادة'));
  });

  it('قيمة المرفوض ورفض الكل', () => {
    expect(refusedValue(order, { a: 1, c: 2 })).toBe(1500);
    expect(refusesAll(order, { a: 1 })).toBe(false);
    // c مرفوض منه 1 سابقاً فالمتاح 2
    expect(refusesAll(order, { a: 2, b: 1, c: 2 })).toBe(true);
  });

  it('فصل مرتجعات الأخذ من الزبون عن تسليم المتاجر', () => {
    const t = (id: string, status: string, returnId?: string) => ({ id, status, returnId }) as ReturnTrip;
    const { pickups, deliveries } = splitReturnTrips([t('1', 'AT_CUSTOMER', 'r1'), t('2', 'AT_CUSTOMER', 'r1'), t('3', 'WITH_DRIVER')]);
    expect(pickups).toHaveLength(1);
    expect(pickups[0]).toHaveLength(2);
    expect(deliveries).toHaveLength(1);
  });

  it('الأحدث أولاً وغير المؤرَّخ في آخر القائمة', () => {
    const rows = [{ d: '2026-10-21T10:00:00Z' }, { d: null }, { d: '2026-10-24T08:00:00Z' }, { d: '2026-10-22T09:00:00Z' }];
    expect(newestFirst(rows, (r) => r.d).map((r) => r.d)).toEqual(['2026-10-24T08:00:00Z', '2026-10-22T09:00:00Z', '2026-10-21T10:00:00Z', null]);
  });
});
