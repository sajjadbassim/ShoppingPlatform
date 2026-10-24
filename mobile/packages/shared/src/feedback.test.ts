import { api } from './api';
import {
  buildReturnFormData,
  hasActiveReturn,
  timeAgoAr,
  returnedQuantities,
  returnLineKey,
  type ReturnRecord,
  createReview,
  distributionShare,
  fetchReviews,
  returnTone,
  validateReturn,
  validateReview,
} from './feedback';

jest.mock('./api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

const entries = (fd: FormData): [string, string][] => {
  const out: [string, string][] = [];
  (fd as unknown as { forEach: (cb: (v: string, k: string) => void) => void }).forEach((v, k) => out.push([k, String(v)]));
  return out;
};

describe('التقييمات', () => {
  it('التحقق', () => {
    expect(validateReview({ rating: 0 }).rating).toBe('اختر عدد النجوم');
    expect(validateReview({ rating: 5, title: 'x'.repeat(201) }).title).toBeTruthy();
    expect(validateReview({ rating: 5, body: 'x'.repeat(2001) }).body).toBeTruthy();
    expect(validateReview({ rating: 4, title: 'ممتاز', body: 'جيد' })).toEqual({});
  });

  it('الإنشاء multipart بالحقول المتوقعة وبلا الفارغ', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { data: { id: 'r1', pointsEarned: 20 } } });
    const review = await createReview({ productId: 'p', orderId: 'o', rating: 5, title: '  ', body: ' رائع ' });
    const [url, body, config] = (api.post as jest.Mock).mock.calls[0];
    expect(url).toContain('Reviews');
    expect(entries(body)).toEqual([['ProductId', 'p'], ['OrderId', 'o'], ['Rating', '5'], ['Body', 'رائع']]);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
    expect(review.pointsEarned).toBe(20);
  });

  it('قائمة التقييمات والإجمالي', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { data: [{ id: 'r1' }], pagination: { total: 7 } } });
    const page = await fetchReviews('p', 1, 5);
    expect((api.get as jest.Mock).mock.calls[0][1].params).toMatchObject({ productId: 'p', pageNumber: 1, pageSize: 5 });
    expect(page.totalCount).toBe(7);
  });

  it('نسبة التوزيع', () => {
    const summary = { averageRating: 4.5, totalReviews: 4, distribution: { '5': 3, '4': 1 } };
    expect(distributionShare(summary, 5)).toBe(0.75);
    expect(distributionShare(summary, 1)).toBe(0);
    expect(distributionShare({ ...summary, totalReviews: 0 }, 5)).toBe(0);
  });
});

describe('المرتجعات', () => {
  it('ترميز القوائم كما في الويب', () => {
    const fd = buildReturnFormData({
      orderId: 'o1',
      reason: 'defective',
      details: ' كسر ',
      items: [{ productId: 'p1', variantId: 'v1', quantity: 2 }, { productId: 'p2', quantity: 1 }],
    });
    expect(entries(fd)).toEqual([
      ['OrderId', 'o1'],
      ['Reason', 'defective'],
      ['Details', 'كسر'],
      ['Items[0].ProductId', 'p1'],
      ['Items[0].VariantId', 'v1'],
      ['Items[0].Quantity', '2'],
      ['Items[1].ProductId', 'p2'],
      ['Items[1].Quantity', '1'],
    ]);
  });

  it('التحقق', () => {
    expect(validateReturn({ reason: '', items: [] })).toEqual({ reason: 'اختر سبب الإرجاع', items: 'اختر منتجاً واحداً على الأقل' });
    expect(validateReturn({ reason: 'other', items: [{ productId: 'p', quantity: 1 }] })).toEqual({});
  });

  it('لون الحالة', () => {
    expect(returnTone('COMPLETED')).toBe('success');
    expect(returnTone('REJECTED')).toBe('error');
    expect(returnTone('PENDING')).toBe('warning');
    expect(returnTone('APPROVED')).toBe('info');
  });
});

describe('returnedQuantities / hasActiveReturn', () => {
  const mk = (over: Partial<ReturnRecord>): ReturnRecord => ({
    id: 'r', returnNumber: 'RET-1', orderId: 'o1', orderNumber: 'ORD-1', status: 'PENDING', statusAr: '', reasonAr: '',
    createdAt: '2026-10-21T00:00:00Z', items: [{ productId: 'p1', variantId: null, productName: 'x', quantity: 2, unitPrice: 1 }], ...over,
  });

  it('يجمع ما أُرجع ويتجاهل المرفوض ورفض الباب والطلبات الأخرى', () => {
    const list = [mk({}), mk({ status: 'REJECTED' }), mk({ isDoorRefusal: true }), mk({ orderId: 'o2' })];
    expect(returnedQuantities('o1', list)).toEqual({ [returnLineKey('p1')]: 2 });
  });

  it('الإرجاع النشط: قيد المراجعة أو موافَق عليه بلا ردّ مبلغ', () => {
    expect(hasActiveReturn('o1', [mk({})])).toBe(true);
    expect(hasActiveReturn('o1', [mk({ status: 'APPROVED' })])).toBe(true);
    expect(hasActiveReturn('o1', [mk({ status: 'APPROVED', refundedAt: '2026-10-22T00:00:00Z' })])).toBe(false);
    expect(hasActiveReturn('o1', [mk({ status: 'REJECTED' })])).toBe(false);
  });
});

describe('timeAgoAr', () => {
  const now = new Date('2026-10-21T12:00:00Z').getTime();
  it('اليوم / أيام / أشهر / سنوات', () => {
    expect(timeAgoAr('2026-10-21T01:00:00Z', now)).toBe('اليوم');
    expect(timeAgoAr('2026-10-18T12:00:00Z', now)).toBe('منذ 3 يوم');
    expect(timeAgoAr('2026-08-21T12:00:00Z', now)).toBe('منذ 2 شهر');
    expect(timeAgoAr('2024-10-21T12:00:00Z', now)).toBe('منذ 2 سنة');
  });
});
