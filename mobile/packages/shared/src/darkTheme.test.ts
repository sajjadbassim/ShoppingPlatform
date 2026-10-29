import { darkHex } from './darkTheme';

describe('darkHex', () => {
  it('يطابق جدول الويب (الرمادي ينقلب والأساسي يفتح)', () => {
    expect(darkHex('#F9FAFB')).toBe('#0B0F19'); // خلفية
    expect(darkHex('#111827')).toBe('#F1F3F6'); // نص
    expect(darkHex('#4F46E5')).toBe('#6366F1'); // أساسي
  });
  it('الأبيض: خلفية ← سطح داكن، ونص يبقى أبيض', () => {
    expect(darkHex('#FFFFFF')).toBe('#151B27');
    expect(darkHex('#FFFFFF', true)).toBe('#FFFFFF');
  });
  it('يقبل أحرفاً صغيرة و#RGB ويحافظ على الشفافية', () => {
    expect(darkHex('#f9fafb')).toBe('#0B0F19');
    expect(darkHex('#FFF')).toBe('#151B27');
    expect(darkHex('#F9FAFB80')).toBe('#0B0F1980');
  });
  it('غير المعروف أو غير اللون يبقى كما هو', () => {
    expect(darkHex('#123456')).toBe('#123456');
    expect(darkHex('rgba(0,0,0,0.4)')).toBe('rgba(0,0,0,0.4)');
    expect(darkHex('transparent')).toBe('transparent');
  });
  it('الألوان الملونة المتوسطة (أزرار وأيقونات) لا تتغير', () => {
    expect(darkHex('#EF4444')).toBe('#EF4444');
    expect(darkHex('#10B981')).toBe('#10B981');
  });
});

import { registerDarkHex } from './darkTheme';

describe('registerDarkHex', () => {
  it('الألوان المسجّلة تتقدّم على جدول الويب وبلا حساسية لحالة الأحرف', () => {
    registerDarkHex({ '#f8ecda': '#2b2118' });
    expect(darkHex('#F8ECDA')).toBe('#2B2118');
    expect(darkHex('#f8ecda80')).toBe('#2B211880');
  });
});
