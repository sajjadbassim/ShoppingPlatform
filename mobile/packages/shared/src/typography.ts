// Tajawal تتجاوز حروفه وعلاماته (الهمزة والشدّة والكسرة) ارتفاع السطر المعتاد: عند ضبط lineHeight صغير
// (أقل من ≈1.25 ضعف الحجم) يقصّ أندرويد أعلى الحروف وأسفلها. قِسناها على المحاكي: 1.3 فأكثر يعرض النص كاملاً.
export const MIN_LINE_HEIGHT_RATIO = 1.3;
export const DEFAULT_FONT_SIZE = 16;

// ارتفاع السطر الآمن: يعيد القيمة المرفوعة إن كان lineHeight أصغر من الحد، وإلا undefined (لا تغيير)
export function safeLineHeight(fontSize: number | undefined, lineHeight: number | undefined): number | undefined {
  if (lineHeight == null) return undefined;
  const min = Math.ceil((fontSize ?? DEFAULT_FONT_SIZE) * MIN_LINE_HEIGHT_RATIO);
  return lineHeight < min ? min : undefined;
}
