import { paginationRange, resolveScope } from './productFilters';

describe('ترقيم الصفحات', () => {
  it('صفحات قليلة تُعرض كلها', () => expect(paginationRange(1, 4)).toEqual([1, 2, 3, 4]));
  it('البداية: 1..5 … الأخيرة', () => expect(paginationRange(1, 13)).toEqual([1, 2, 3, 4, 5, '...', 13]));
  it('الوسط: 1 … 6 7 8 … 13', () => expect(paginationRange(7, 13)).toEqual([1, '...', 6, 7, 8, '...', 13]));
  it('النهاية: 1 … 9..13', () => expect(paginationRange(13, 13)).toEqual([1, '...', 9, 10, 11, 12, 13]));
});

describe('resolveScope', () => {
  it('السوبرماركت', () => expect(resolveScope({ grocery: true })).toBe('grocery'));
  it('بلا فئة: العام', () => expect(resolveScope({ grocery: false })).toBe('general'));
  it('مع فئة أو متجر: بلا قسم', () => {
    expect(resolveScope({ grocery: false, categoryId: 'c' })).toBeUndefined();
    expect(resolveScope({ grocery: false, vendorId: 'v' })).toBeUndefined();
  });
});
