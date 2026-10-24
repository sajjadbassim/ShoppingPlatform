import {
  discountPercentOf,
  formatCountdown,
  homeBarCategories,
  msUntil,
  sectionTarget,
  splitBannerBlock,
  visibleSections,
  type HomeSection,
} from './home';

const section = (over: Partial<HomeSection>): HomeSection => ({ id: 's', type: 'featured_products', title: 't', displayOrder: 0, ...over });

describe('الرئيسية', () => {
  it('نسبة الخصم من السعرين، وإلا المحفوظة', () => {
    expect(discountPercentOf({ price: 90, originalPrice: 100, discountPercentage: 5 })).toBe(10);
    expect(discountPercentOf({ price: 90, originalPrice: null, discountPercentage: 7.4 })).toBe(7);
    expect(discountPercentOf({ price: 90 })).toBe(0);
  });

  it('الأقسام: المفعّلة فقط، مرتبة، وبلا أفضل الفئات', () => {
    const out = visibleSections([
      section({ id: 'b', displayOrder: 2 }),
      section({ id: 'a', displayOrder: 1, type: 'banners' }),
      section({ id: 'x', displayOrder: 0, type: 'top_categories' }),
      section({ id: 'off', displayOrder: 0, isActive: false }),
    ]);
    expect(out.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('عرض المزيد: القسم ← المنتجات، المتجر وحده ← المتجر، والسوبرماركت يبقى فيه', () => {
    expect(sectionTarget(section({ filterCategoryId: 'c' }))).toEqual({ kind: 'products', params: { categoryId: 'c' } });
    expect(sectionTarget(section({ filterVendorId: 'v' }))).toEqual({ kind: 'store', vendorId: 'v' });
    expect(sectionTarget(section({ page: 'grocery' }))).toEqual({ kind: 'products', params: { scope: 'grocery' } });
    expect(sectionTarget(section({ id: 'd', type: 'custom_products', filterCategoryId: 'c' }))).toEqual({ kind: 'section', sectionId: 'd' });
    expect(sectionTarget(section({ id: 'f', type: 'flash_deals' }))).toEqual({ kind: 'section', sectionId: 'f' });
  });

  it('بلوك البانرات: 1 عريض، 2 متجاوران، 3 عريض + شبكة', () => {
    expect(splitBannerBlock([1])).toEqual({ wide: 1, grid: [] });
    expect(splitBannerBlock([1, 2])).toEqual({ wide: null, grid: [1, 2] });
    expect(splitBannerBlock([1, 2, 3])).toEqual({ wide: 1, grid: [2, 3] });
  });

  it('العدّاد: التاريخ بلا منطقة يُعامل كـUTC، والمنتهي = 0', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(msUntil('2026-01-01T01:00:00', now)).toBe(3_600_000);
    expect(msUntil('2025-12-31T00:00:00Z', now)).toBe(0);
    expect(msUntil(null, now)).toBe(0);
    expect(formatCountdown(3_723_000)).toBe('01:02:03');
    expect(formatCountdown(90_000_000)).toBe('01:00:00 + 1d');
  });

  it('شريط الفئات: الرئيسية غير السوبرماركت التي فيها منتجات', () => {
    const out = homeBarCategories([
      { id: 'a', parentId: null, productsCount: 3 },
      { id: 'b', parentId: 'a', productsCount: 3 },
      { id: 'g', parentId: null, isGrocery: true, productsCount: 3 },
      { id: 'e', parentId: null, productsCount: 0 },
    ] as { id: string; parentId: string | null; isGrocery?: boolean; productsCount: number }[]);
    expect(out.map((c) => c.id)).toEqual(['a']);
  });
});
