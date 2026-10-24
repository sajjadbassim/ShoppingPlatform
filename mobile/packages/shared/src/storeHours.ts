// أوقات عمل المتجر (مطابقة لـ StoreHoursEditor في الويب): 0 = الأحد، والأسبوع العراقي يبدأ بالسبت
export interface WorkingDay {
  day: number;
  closed?: boolean;
  open?: string;
  close?: string;
}

export const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

// جدول كامل للأيام السبعة (الأيام الناقصة مغلقة)
export const fullSchedule = (hours?: WorkingDay[] | null): Required<WorkingDay>[] =>
  WEEK_ORDER.map((day) => {
    const d = hours?.find((h) => h.day === day);
    return d
      ? { day, closed: !!d.closed, open: d.open || '09:00', close: d.close || '22:00' }
      : { day, closed: true, open: '09:00', close: '22:00' };
  });

// 21:30 ← 9:30 م
export const formatTime = (hhmm: string): string => {
  const [h, m] = (hhmm || '').split(':').map(Number);
  if (!Number.isFinite(h)) return hhmm;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`;
};

export const describeDay = (d: Required<WorkingDay>): string =>
  d.closed ? 'مغلق' : d.open === d.close ? '24 ساعة' : `${formatTime(d.open)} – ${formatTime(d.close)}`;

// يوم اليوم بتوقيت بغداد (UTC+3) كما في الويب
export const todayInBaghdad = (): number =>
  new Date(Date.now() + (3 * 60 + new Date().getTimezoneOffset()) * 60000).getDay();
