import {
  activityFrom,
  allMissing,
  bulkPriceFields,
  canDo,
  combinationKey,
  commissionLabel,
  discountPercent,
  filterVendorProducts,
  formatDecisionCountdown,
  itemTitle,
  marketingStatus,
  missingCount,
  nextOrderStep,
  partialSubtotal,
  productCounts,
  productToForm,
  secondsLeft,
  toUnavailableItems,
  validateProductForm,
  validateStaff,
  variantCombinations,
  EMPTY_PRODUCT_FORM,
  type VendorOrderItem,
  type VendorProduct,
} from './vendor';

const product = (over: Partial<VendorProduct>): VendorProduct => ({
  id: 'p', name: 'Phone', nameAr: 'هاتف', price: 100, stockQuantity: 20, isAvailable: true, isActive: true, hasVariants: false, images: [], ...over,
});

const item = (over: Partial<VendorOrderItem>): VendorOrderItem => ({
  id: 'i', productId: 'p', productName: 'P', refusedQuantity: 0, returnedQuantity: 0, unavailableQuantity: 0, unitPrice: 10, quantity: 3, subtotal: 30, ...over,
});

describe('الصلاحيات', () => {
  it('الصاحب بلا قيود والموظف بحسب صلاحياته', () => {
    expect(canDo({ isStoreStaff: false, permissions: null }, 'finance')).toBe(true);
    expect(canDo({ isStoreStaff: true, permissions: ['orders'] }, 'orders')).toBe(true);
    expect(canDo({ isStoreStaff: true, permissions: ['orders'] }, 'finance')).toBe(false);
    expect(canDo(null, 'orders')).toBe(true);
  });
});

describe('الطلبات', () => {
  it('الخطوة التالية بعد القبول', () => {
    expect(nextOrderStep('CONFIRMED')?.step).toBe('preparing');
    expect(nextOrderStep('PREPARING')?.step).toBe('ready');
    expect(nextOrderStep('READY')).toBeNull();
    expect(nextOrderStep('PENDING_CONFIRMATION')).toBeNull();
  });

  it('عدّاد القرار ينتهي عند الصفر ولا يُلغى الطلب', () => {
    const now = Date.parse('2026-10-24T10:00:00Z');
    expect(secondsLeft('2026-10-24T10:05:30Z', now)).toBe(330);
    expect(secondsLeft('2026-10-24T09:00:00Z', now)).toBe(0);
    expect(secondsLeft(null, now)).toBeNull();
    expect(formatDecisionCountdown(330)).toBe('5:30');
    expect(formatDecisionCountdown(0)).toBe('انتهت المهلة');
    expect(formatDecisionCountdown(3 * 3600 + 120)).toBe('3س 2د');
  });

  it('اسم القطعة مع المتغير', () => {
    expect(itemTitle({ productName: 'Shirt', productNameAr: 'قميص', variantLabel: 'L · أحمر' })).toBe('قميص (L · أحمر)');
    expect(itemTitle({ productName: 'Shirt' })).toBe('Shirt');
  });

  it('القبول الجزئي: المجموع والبدائل', () => {
    const items = [item({ id: 'a', quantity: 3, unitPrice: 10 }), item({ id: 'b', quantity: 1, unitPrice: 50 })];
    expect(partialSubtotal(items, { a: 1 })).toBe(2 * 10 + 50);
    expect(partialSubtotal(items, { a: 1 }, (it) => (it.id === 'a' ? 8 : 0))).toBe(2 * 10 + 50 + 8);
    expect(missingCount({ a: 1, b: 2 })).toBe(3);
    expect(allMissing(items, { a: 3, b: 1 })).toBe(true);
    expect(allMissing(items, { a: 3 })).toBe(false);
    expect(toUnavailableItems({ a: 2, b: 0 }, { a: 'x' }, true)).toEqual([{ itemId: 'a', quantity: 2, replacementProductId: 'x' }]);
    expect(toUnavailableItems({ a: 2 }, { a: 'x' }, false)).toEqual([{ itemId: 'a', quantity: 2 }]);
  });
});

describe('المنتجات', () => {
  const list = [
    product({ id: '1', nameAr: 'ب', price: 300, stockQuantity: 0, createdAt: '2026-10-01T00:00:00Z' }),
    product({ id: '2', nameAr: 'أ', price: 100, stockQuantity: 3, isActive: false, createdAt: '2026-10-03T00:00:00Z', sku: 'ABC-1' }),
    product({ id: '3', nameAr: 'ج', price: 200, stockQuantity: 50, createdAt: '2026-10-02T00:00:00Z' }),
  ];

  it('الأعداد حسب الفلاتر', () => {
    expect(productCounts(list)).toEqual({ all: 3, visible: 2, hidden: 1, low: 1, out: 1 });
  });

  it('الفلترة والبحث والترتيب', () => {
    const ids = (f: Parameters<typeof filterVendorProducts>[1]) => filterVendorProducts(list, f).map((p) => p.id);
    expect(ids({ filter: 'out', search: '', sort: 'newest' })).toEqual(['1']);
    expect(ids({ filter: 'hidden', search: '', sort: 'newest' })).toEqual(['2']);
    expect(ids({ filter: 'all', search: 'abc', sort: 'newest' })).toEqual(['2']);
    expect(ids({ filter: 'all', search: '', sort: 'newest' })).toEqual(['2', '3', '1']);
    expect(ids({ filter: 'all', search: '', sort: 'price_desc' })).toEqual(['1', '3', '2']);
    expect(ids({ filter: 'all', search: '', sort: 'stock_asc' })).toEqual(['1', '2', '3']);
    expect(filterVendorProducts(list, { filter: 'all', search: '', sort: 'best', sold: { '3': { sold: 9 }, '1': { sold: 2 } } }).map((p) => p.id)[0]).toBe('3');
  });

  it('نسبة الخصم', () => {
    expect(discountPercent(80, 100)).toBe(20);
    expect(discountPercent(100, 100)).toBe(0);
    expect(discountPercent(100, null)).toBe(0);
  });

  it('التسعير الجماعي', () => {
    const p = product({ price: 1000, regularPrice: 1000 });
    expect(bulkPriceFields(p, 'percent', 10)).toEqual({ Price: '1100' });
    expect(bulkPriceFields(p, 'percent', -10)).toEqual({ Price: '900' });
    expect(bulkPriceFields(p, 'discount', 20)).toEqual({ Price: '800', OriginalPrice: '1000' });
    expect(bulkPriceFields(p, 'discount', 100)).toBeNull();
    expect(bulkPriceFields(p, 'clearDiscount', 0)).toBeNull();
    expect(bulkPriceFields(product({ price: 800, regularPrice: 800, regularOriginalPrice: 1000 }), 'clearDiscount', 0)).toEqual({ Price: '1000', ClearOriginalPrice: 'true' });
  });

  it('نموذج المنتج: المخزّن لا المعروض، وبالكيلو للوزن', () => {
    const form = productToForm(product({ price: 80, regularPrice: 100, regularOriginalPrice: 120, regularStockQuantity: 8, stockQuantity: 8, weightStepKg: 0.5, description: '-' }));
    expect(form.Price).toBe('200');
    expect(form.OriginalPrice).toBe('240');
    expect(form.StockQuantity).toBe('4');
    expect(form.WeightStep).toBe('0.5');
    expect(form.Description).toBe('');
  });

  it('التحقق من النموذج', () => {
    expect(validateProductForm(EMPTY_PRODUCT_FORM, 0, false)).toEqual({ NameAr: 'اكتب اسم المنتج', Price: 'اكتب سعر البيع', images: 'أضف صورة واحدة على الأقل' });
    expect(validateProductForm({ ...EMPTY_PRODUCT_FORM, NameAr: 'س', Price: '100', OriginalPrice: '90' }, 1, true)).toEqual({ OriginalPrice: 'يجب أن يكون أعلى من سعر البيع ليظهر كخصم' });
    expect(validateProductForm({ ...EMPTY_PRODUCT_FORM, NameAr: 'س', Price: '100' }, 0, true)).toEqual({});
  });
});

describe('المتغيرات', () => {
  const attrs = [
    { id: 'c', name: 'Color', displayOrder: 0, values: [{ id: 'c1', value: 'a', displayOrder: 0 }, { id: 'c2', value: 'b', displayOrder: 1 }] },
    { id: 's', name: 'Size', displayOrder: 1, values: [{ id: 's1', value: 'S', displayOrder: 0 }, { id: 's2', value: 'L', displayOrder: 1 }, { id: 's3', value: 'XL', displayOrder: 2 }] },
    { id: 'e', name: 'Empty', displayOrder: 2, values: [] },
  ];

  it('كل التوليفات وتجاهل الصفة الفارغة', () => {
    const combos = variantCombinations(attrs);
    expect(combos).toHaveLength(6);
    expect(combos[0]).toEqual(['c1', 's1']);
  });

  it('مفتاح التوليفة لا يعتمد على الترتيب', () => {
    expect(combinationKey(['b', 'a'])).toBe(combinationKey(['a', 'b']));
  });
});

describe('التسويق', () => {
  it('حالة العرض والكوبون', () => {
    expect(marketingStatus({ isActive: true, isExpired: false })).toEqual({ label: 'فعّال', tone: 'ok' });
    expect(marketingStatus({ isActive: false, isExpired: false })).toEqual({ label: 'متوقف', tone: 'muted' });
    expect(marketingStatus({ isActive: true, isExpired: true })).toEqual({ label: 'منتهٍ', tone: 'muted' });
    expect(marketingStatus({ isActive: true, isExpired: false, isScheduled: true })).toEqual({ label: 'مجدول', tone: 'warn' });
    expect(marketingStatus({ isActive: true, isExpired: false, isUsageLimitReached: true }).label).toBe('اكتمل استخدامه');
  });

  it('نص العمولة', () => {
    expect(commissionLabel({ type: 'PERCENT', value: 10 })).toBe('10%');
    expect(commissionLabel({ type: 'FIXED', value: 1500 })).toBe('1,500 د.ع / طلب');
    expect(commissionLabel(null)).toBe('—');
  });
});

describe('الموظفون والنشاط', () => {
  it('التحقق من نموذج الموظف', () => {
    expect(validateStaff({ fullName: 'سارة', phone: '0770', password: '123456', permissions: ['orders'], fullAccess: false }, false)).toBe(true);
    expect(validateStaff({ fullName: 'سارة', phone: '0770', password: '123', permissions: ['orders'], fullAccess: false }, false)).toBe(false);
    expect(validateStaff({ fullName: 'سارة', phone: '', password: '', permissions: [], fullAccess: false }, true)).toBe(false);
    expect(validateStaff({ fullName: 'سارة', phone: '', password: '', permissions: [], fullAccess: true }, true)).toBe(true);
  });

  it('بداية الفترة بتوقيت بغداد', () => {
    const now = Date.parse('2026-10-24T22:30:00Z'); // 1:30 صباح 25 أكتوبر في بغداد
    expect(activityFrom(0, now)).toBe('2026-10-24T21:00:00.000Z');
    expect(activityFrom(7, now)).toBe('2026-10-17T21:00:00.000Z');
    expect(activityFrom(null, now)).toBeUndefined();
  });
});
