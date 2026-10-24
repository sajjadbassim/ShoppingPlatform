import { api } from './api';
import {
  canCancelOrder,
  cancelOrder,
  fetchOrders,
  isActiveOrder,
  orderStatusAr,
  orderStatusTone,
  type SubOrder,
} from './myOrders';

jest.mock('./api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

const sub = (status: string) => ({ status }) as SubOrder;

describe('حالات الطلب', () => {
  it('النص العربي', () => {
    expect(orderStatusAr('OUT_FOR_DELIVERY')).toBe('في الطريق');
    expect(orderStatusAr('DELIVERY_FAILED')).toBe('تعذّر التسليم');
    expect(orderStatusAr('UNKNOWN')).toBe('UNKNOWN');
    expect(orderStatusAr(null)).toBe('—');
  });

  it('الحالية والمنتهية', () => {
    expect(isActiveOrder('PREPARING')).toBe(true);
    expect(isActiveOrder('DELIVERED')).toBe(false);
    expect(isActiveOrder('CANCELLED')).toBe(false);
  });

  it('لون الحالة', () => {
    expect(orderStatusTone('DELIVERED')).toBe('success');
    expect(orderStatusTone('CANCELLED')).toBe('error');
    expect(orderStatusTone('PENDING_CONFIRMATION')).toBe('warning');
    expect(orderStatusTone('PREPARING')).toBe('info');
  });
});

describe('canCancelOrder (نفس شرط الخادم)', () => {
  it('قبل بدء التحضير', () => {
    expect(canCancelOrder({ status: 'PENDING_CONFIRMATION', subOrders: [sub('PENDING_CONFIRMATION')] })).toBe(true);
    expect(canCancelOrder({ status: 'CONFIRMED', subOrders: [sub('CONFIRMED'), sub('CANCELLED')] })).toBe(true);
    expect(canCancelOrder({ status: 'PARTIALLY_CONFIRMED', subOrders: [sub('CONFIRMED'), sub('PENDING_CONFIRMATION')] })).toBe(true);
  });

  it('بعد بدء التحضير في أي متجر', () => {
    expect(canCancelOrder({ status: 'CONFIRMED', subOrders: [sub('CONFIRMED'), sub('PREPARING')] })).toBe(false);
  });

  it('حالات لا تُلغى', () => {
    expect(canCancelOrder({ status: 'PREPARING', subOrders: [sub('PENDING_CONFIRMATION')] })).toBe(false);
    expect(canCancelOrder({ status: 'DELIVERED', subOrders: [] })).toBe(false);
  });
});

describe('الجلب', () => {
  it('قائمة الطلبات بالصفحة والترقيم', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { data: [{ id: 'o1' }], pagination: { currentPage: 2, hasNext: false } },
    });
    const page = await fetchOrders(2, 10);
    expect((api.get as jest.Mock).mock.calls[0][1]).toEqual({ params: { pageNumber: 2, pageSize: 10 } });
    expect(page.items[0].id).toBe('o1');
    expect(page.pagination.hasNext).toBe(false);
  });

  it('الإلغاء يرسل السبب منظّفاً', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { data: { id: 'o1', status: 'CANCELLED' } } });
    const order = await cancelOrder('o1', '  غيّرت رأيي ');
    expect((api.post as jest.Mock).mock.calls[0][1]).toEqual({ reason: 'غيّرت رأيي' });
    expect(order.status).toBe('CANCELLED');
  });
});
