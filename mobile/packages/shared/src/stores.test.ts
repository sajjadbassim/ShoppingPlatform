import { filterStores, splitFeaturedStore, storesOfSection, totalProductsOf, type StoreListItem } from './stores';

const s = (id: string, over: Partial<StoreListItem> = {}): StoreListItem => ({ id, name: id, ...over });

describe('المتاجر', () => {
  const all = [
    s('a', { nameAr: 'متجر النخبة', productsCount: 37, deliveryFee: 3000, rating: 4 }),
    s('b', { nameAr: 'أزياء المدينة', address: 'بغداد - المنصور', productsCount: 15, deliveryFee: 4000, rating: 5 }),
    s('c', { nameAr: 'بيت الديكور', productsCount: 10, deliveryFee: null }),
  ];

  it('الترتيب: الأكثر منتجات، أقل توصيل (المجهول آخراً)، الأعلى تقييماً', () => {
    expect(filterStores(all, '', 'products').map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(filterStores(all, '', 'delivery').map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(filterStores(all, '', 'rating').map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('البحث بالاسم أو العنوان، والمميزة تبقى بترتيبها', () => {
    expect(filterStores(all, 'المنصور', 'products').map((x) => x.id)).toEqual(['b']);
    expect(filterStores([all[2], all[0]], '', null).map((x) => x.id)).toEqual(['c', 'a']);
  });

  it('متاجر القسم بترتيبه ومن القائمة الكاملة، ويُسقط المفقود', () => {
    expect(storesOfSection(all, [{ id: 'c' }, { id: 'x' }, { id: 'a' }]).map((x) => x.id)).toEqual(['c', 'a']);
  });

  it('المتجر المميز: الأول بلا بحث ومع أكثر من متجر', () => {
    expect(splitFeaturedStore(all, false).featured?.id).toBe('a');
    expect(splitFeaturedStore(all, true).featured).toBeNull();
    expect(splitFeaturedStore([all[0]], false).featured).toBeNull();
    expect(totalProductsOf(all)).toBe(62);
  });
});
