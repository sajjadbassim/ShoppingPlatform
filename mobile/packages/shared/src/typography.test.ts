import { safeLineHeight } from './typography';

describe('safeLineHeight', () => {
  it('لا يغيّر شيئاً إن لم يُضبط lineHeight', () => {
    expect(safeLineHeight(14, undefined)).toBeUndefined();
  });
  it('يرفع lineHeight الأصغر من 1.3 ضعف الحجم', () => {
    expect(safeLineHeight(20, 24)).toBe(26);
    expect(safeLineHeight(28, 34)).toBe(37);
    expect(safeLineHeight(12, 14)).toBe(16);
  });
  it('يترك الكافي كما هو', () => {
    expect(safeLineHeight(20, 26)).toBeUndefined();
    expect(safeLineHeight(14, 24)).toBeUndefined();
  });
  it('الحجم الافتراضي 16 عند غيابه', () => {
    expect(safeLineHeight(undefined, 18)).toBe(21);
  });
});
