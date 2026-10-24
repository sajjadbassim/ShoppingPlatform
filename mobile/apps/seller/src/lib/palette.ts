import { configurePalette } from '@wasit/ui';

// هوية تطبيق البائع: كريمي #FEF3E2، عنبري #F4AE52، برتقالي محروق #D4621A، بني داكن #2A1A0E.
// تُطبَّق قبل رسم أي شاشة (تُستورد أولاً في _layout). تبقى فاتحة فقط: جدول الداكن مبني على لوحة الويب
export const palette = {
  cream: '#FEF3E2',
  amber: '#F4AE52',
  burnt: '#D4621A',
  burntDeep: '#B5500F', // خلفية الأزرار المصمتة: الأبيض عليها بتباين مقبول
  ink: '#2A1A0E',
  inkSoft: '#7A6552',
  page: '#FFF9F0',
  line: '#F0E2CC',
  tint: '#F8ECDA',
  ok: '#3E8E67',
  okSoft: '#E1F2E8',
  warnSoft: '#FDEBCB',
  warnText: '#8A4B0C',
  bad: '#C2413A',
  badSoft: '#FBE6E3',
} as const;

configurePalette({
  colors: {
    primary: palette.burnt,
    primaryHover: palette.burntDeep,
    primaryLight: palette.cream,
    background: palette.page,
    surface: '#FFFFFF',
    border: palette.line,
    text: palette.ink,
    textMuted: palette.inkSoft,
    placeholder: '#A8937E',
    success: palette.ok,
    successLight: palette.okSoft,
    warning: palette.amber,
    error: palette.bad,
    errorDark: '#A8322C',
    errorLight: palette.badSoft,
  },
  brand: {
    ink: palette.ink,
    offer: palette.burnt,
    offerEnd: palette.amber,
    gold: palette.amber,
    goldLight: palette.cream,
    goldBorder: palette.amber,
    goldText: palette.warnText,
    surfaceMuted: palette.tint,
  },
});
