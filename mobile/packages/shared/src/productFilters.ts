import type { ProductQuery } from './catalog';

// خيارات الترتيب كما في صفحة المنتجات في الويب (SORT_MAP)
export type SortKey = 'newest' | 'price-low' | 'price-high' | 'rating' | 'name' | 'sales';

export const SORT_OPTIONS: { key: SortKey; label: string; sortBy?: ProductQuery['sortBy']; sortOrder?: 'asc' | 'desc' }[] = [
  { key: 'newest', label: 'الأحدث' },
  { key: 'price-low', label: 'السعر: الأقل', sortBy: 'price', sortOrder: 'asc' },
  { key: 'price-high', label: 'السعر: الأعلى', sortBy: 'price', sortOrder: 'desc' },
  { key: 'rating', label: 'الأعلى تقييماً', sortBy: 'rating' },
  { key: 'name', label: 'الاسم', sortBy: 'name', sortOrder: 'asc' },
  { key: 'sales', label: 'الأكثر مبيعاً', sortBy: 'sales' },
];

// نطاقات السعر السريعة (د.ع)
export const QUICK_PRICE_RANGES: { label: string; min: string; max: string }[] = [
  { label: 'أقل من 50K', min: '', max: '50000' },
  { label: '50K - 200K', min: '50000', max: '200000' },
  { label: '200K - 500K', min: '200000', max: '500000' },
  { label: 'أكثر من 500K', min: '500000', max: '' },
];

// أرقام الصفحات المعروضة: 1 2 3 4 5 … 13 (نفس خوارزمية Pagination في الويب)
export const paginationRange = (currentPage: number, totalPages: number, siblingCount = 1): (number | '...')[] => {
  const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
  if (totalPages <= siblingCount * 2 + 3) return range(1, totalPages);

  const left = Math.max(currentPage - siblingCount, 1);
  const right = Math.min(currentPage + siblingCount, totalPages);
  const dotsLeft = left > 2;
  const dotsRight = right < totalPages - 1;
  const edgeCount = 3 + 2 * siblingCount;

  if (!dotsLeft && dotsRight) return [...range(1, edgeCount), '...', totalPages];
  if (dotsLeft && !dotsRight) return [1, '...', ...range(totalPages - edgeCount + 1, totalPages)];
  if (dotsLeft && dotsRight) return [1, '...', ...range(left, right), '...', totalPages];
  return range(1, totalPages);
};

// الأقسام: السوبرماركت منفصل، وبلا فئة أو متجر محدد تُعرض منتجات القسم العام فقط (كما في الويب)
export const resolveScope = (opts: { grocery: boolean; categoryId?: string; vendorId?: string }): ProductQuery['scope'] =>
  opts.grocery ? 'grocery' : opts.categoryId || opts.vendorId ? undefined : 'general';
