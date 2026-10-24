import {
  buildOptionGroups,
  findVariant,
  isOptionAvailable,
  priceRange,
  type ProductVariant,
} from './catalog';

const attr = (attributeId: string, valueId: string, value: string) => ({
  attributeId,
  attributeName: attributeId,
  attributeNameAr: attributeId === 'size' ? 'القياس' : 'اللون',
  valueId,
  value,
  valueAr: value,
});

const variant = (id: string, price: number, stock: number, ...attributes: ReturnType<typeof attr>[]): ProductVariant => ({
  id,
  productId: 'p',
  finalPrice: price,
  stockQuantity: stock,
  isAvailable: true,
  inStock: stock > 0,
  displayOrder: 0,
  attributes,
});

const variants = [
  variant('v1', 1000, 3, attr('size', 's36', '36'), attr('color', 'red', 'أحمر')),
  variant('v2', 1200, 0, attr('size', 's36', '36'), attr('color', 'blue', 'أزرق')),
  variant('v3', 1500, 5, attr('size', 's37', '37'), attr('color', 'red', 'أحمر')),
];

describe('buildOptionGroups', () => {
  it('مجموعة لكل خاصية بقيم فريدة', () => {
    const groups = buildOptionGroups(variants);
    expect(groups.map((g) => g.attributeId)).toEqual(['size', 'color']);
    expect(groups[0].name).toBe('القياس');
    expect(groups[0].values.map((v) => v.label)).toEqual(['36', '37']);
    expect(groups[1].values.map((v) => v.label)).toEqual(['أحمر', 'أزرق']);
  });

  it('بلا متغيّرات ← لا مجموعات', () => expect(buildOptionGroups([])).toEqual([]));
});

describe('findVariant', () => {
  const groups = buildOptionGroups(variants);

  it('اختيار ناقص ← null', () => {
    expect(findVariant(variants, groups, { size: 's36' })).toBeNull();
  });

  it('اختيار كامل ← المتغيّر المطابق', () => {
    expect(findVariant(variants, groups, { size: 's37', color: 'red' })?.id).toBe('v3');
  });

  it('توليفة غير موجودة ← null', () => {
    expect(findVariant(variants, groups, { size: 's37', color: 'blue' })).toBeNull();
  });
});

describe('isOptionAvailable', () => {
  it('قيمة بتوليفة متاحة', () => {
    expect(isOptionAvailable(variants, {}, 'size', 's36')).toBe(true);
  });

  it('مع اللون الأزرق: القياس 36 نفد مخزونه والقياس 37 غير موجود', () => {
    expect(isOptionAvailable(variants, { color: 'blue' }, 'size', 's36')).toBe(false);
    expect(isOptionAvailable(variants, { color: 'blue' }, 'size', 's37')).toBe(false);
  });

  it('متغيّر غير متاح للبيع لا يُحسب', () => {
    const off = [{ ...variants[0], isAvailable: false }];
    expect(isOptionAvailable(off, {}, 'size', 's36')).toBe(false);
  });
});

describe('priceRange', () => {
  it('أدنى وأعلى سعر', () => expect(priceRange(variants)).toEqual({ min: 1000, max: 1500 }));
  it('بلا متغيّرات ← null', () => expect(priceRange([])).toBeNull());
});
