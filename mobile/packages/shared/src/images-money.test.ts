import { getImageUrl, IMG_SIZE } from './images';
import { formatPrice, isByWeight, pricePerKg } from './money';
import { isProductBuyable, type ProductSummary } from './home';

describe('getImageUrl', () => {
  it('بلا مسار ← null', () => {
    expect(getImageUrl(null)).toBeNull();
    expect(getImageUrl('')).toBeNull();
  });

  it('رابط كامل يبقى كما هو', () => {
    expect(getImageUrl('https://cdn.example.com/a.jpg', IMG_SIZE.CARD)).toBe('https://cdn.example.com/a.jpg');
  });

  it('صور uploads تأخذ عرض النسخة المصغّرة', () => {
    expect(getImageUrl('/uploads/products/a.jpg', IMG_SIZE.CARD)).toMatch(/\/uploads\/products\/a\.jpg\?w=600$/);
    expect(getImageUrl('uploads/products/a.jpg', IMG_SIZE.THUMB)).toMatch(/\/uploads\/products\/a\.jpg\?w=200$/);
  });

  it('بلا عرض أو خارج uploads أو فيها استعلام ← بلا تغيير', () => {
    expect(getImageUrl('/uploads/a.jpg')).toMatch(/\/uploads\/a\.jpg$/);
    expect(getImageUrl('/static/a.jpg', 600)).toMatch(/\/static\/a\.jpg$/);
    expect(getImageUrl('/uploads/a.jpg?v=2', 600)).toMatch(/\/uploads\/a\.jpg\?v=2$/);
  });
});

describe('formatPrice', () => {
  it('الدينار بلا كسور وبفواصل الآلاف', () => {
    expect(formatPrice(3000)).toBe('3,000 د.ع');
    expect(formatPrice(1234.6)).toBe('1,235 د.ع');
    expect(formatPrice(0)).toBe('0 د.ع');
  });

  it('البيع بالوزن: سعر الكيلو من سعر الوحدة', () => {
    expect(pricePerKg(1500, 0.5)).toBe(3000);
    expect(formatPrice(1500, 0.5)).toBe('3,000 د.ع / كغم');
    expect(isByWeight({ weightStepKg: 0.25 })).toBe(true);
    expect(isByWeight({ weightStepKg: null })).toBe(false);
  });
});

describe('isProductBuyable', () => {
  const product = { isAvailable: true, stockQuantity: 5 } as ProductSummary;

  it('متاح وبمخزون', () => expect(isProductBuyable(product)).toBe(true));
  it('نفد المخزون أو غير متاح', () => {
    expect(isProductBuyable({ ...product, stockQuantity: 0 })).toBe(false);
    expect(isProductBuyable({ ...product, isAvailable: false })).toBe(false);
  });
});
