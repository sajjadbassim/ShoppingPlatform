import { pushTargetFromUrl } from './push';

describe('pushTargetFromUrl', () => {
  it('مسار الطلب برقمه', () => {
    expect(pushTargetFromUrl('/orders/ORD-20261021-0001')).toEqual({ kind: 'order', orderNumber: 'ORD-20261021-0001' });
    expect(pushTargetFromUrl('/orders/ORD-1?tab=track')).toEqual({ kind: 'order', orderNumber: 'ORD-1' });
  });
  it('الإرجاع', () => {
    expect(pushTargetFromUrl('/returns')).toEqual({ kind: 'returns' });
  });
  it('أي شيء آخر أو غياب المسار يفتح الإشعارات', () => {
    expect(pushTargetFromUrl('/loyalty')).toEqual({ kind: 'notifications' });
    expect(pushTargetFromUrl('/notifications')).toEqual({ kind: 'notifications' });
    expect(pushTargetFromUrl(undefined)).toEqual({ kind: 'notifications' });
    expect(pushTargetFromUrl('/orders/a/b')).toEqual({ kind: 'notifications' });
  });
});
