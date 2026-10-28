// فلتر الفترة لقوائم المندوب (الطلبات والنقد). يعتمد على الوقت المحلي للهاتف
export type Period = 'all' | 'today' | 'yesterday' | 'week';

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: 'yesterday', label: 'أمس' },
  { value: 'week', label: '7 أيام' },
  { value: 'all', label: 'الكل' },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 24 * 60 * 60 * 1000;

export const inPeriod = (iso: string | null | undefined, period: Period, now = new Date()): boolean => {
  if (period === 'all') return true;
  const t = Date.parse(iso ?? '');
  if (!t) return false;
  const today = startOfDay(now);
  if (period === 'today') return t >= today;
  if (period === 'yesterday') return t >= today - DAY && t < today;
  return t >= today - 6 * DAY;
};

// عنوان اليوم لتجميع القوائم: اليوم / أمس / تاريخ
export const dayKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
