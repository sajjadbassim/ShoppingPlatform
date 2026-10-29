import { registerDarkHex } from '@wasit/shared';
import { configurePalette, isDarkTheme } from '@wasit/ui';

// هوية تطبيق البائع: كريمي #FEF3E2، عنبري #F4AE52، برتقالي محروق #D4621A، بني داكن #2A1A0E.
// وضعان: فاتح كريمي وداكن بني دافئ بلوحتين صريحتين. تُطبَّق قبل رسم أي شاشة (تُستورد أولاً في _layout)
const light = {
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
  okText: '#2D6B4B',
  badText: '#A8322C',
  chipOn: '#2A1A0E', // خلفية العنصر المختار بنص أبيض (شريحة فلتر، خيار)
} as const;

const dark: Record<keyof typeof light, string> = {
  cream: '#3A2315',
  amber: '#F4AE52',
  burnt: '#E8782A',
  burntDeep: '#C45F14',
  ink: '#F6EEE6',
  inkSoft: '#B8A593',
  page: '#17120D',
  line: '#3A2E22',
  tint: '#2B2118',
  ok: '#4FB783',
  okSoft: '#16352A',
  warnSoft: '#3D2B10',
  warnText: '#F0B46A',
  bad: '#F0766E',
  badSoft: '#3E1F1C',
  okText: '#7FD6A8',
  badText: '#FF9A90',
  chipOn: '#C45F14',
};

// تُقرأ عند الرسم فتتبع الوضع الحالي (المكوّنات تُعاد رسمها عند التبديل بـuseTheme)
export const palette = Object.fromEntries(
  (Object.keys(light) as (keyof typeof light)[]).map((key) => [key, undefined]),
) as unknown as Record<keyof typeof light, string>;
for (const key of Object.keys(light) as (keyof typeof light)[]) {
  Object.defineProperty(palette, key, { enumerable: true, get: () => (isDarkTheme() ? dark[key] : light[key]) });
}

// ألوان مكتوبة مباشرة في الشاشات (#F8ECDA...) تقابلها في الداكن
registerDarkHex({
  '#FFFFFF': '#211A14',
  '#F8ECDA': dark.tint,
  '#FEF3E2': dark.cream,
  '#FFF9F0': dark.page,
  '#F0E2CC': dark.line,
  '#2A1A0E': dark.ink,
  '#7A6552': dark.inkSoft,
  '#A8937E': '#7F6E5E',
  '#D4621A': dark.burnt,
  '#B5500F': dark.burntDeep,
  '#3E8E67': dark.ok,
  '#E1F2E8': dark.okSoft,
  '#FDEBCB': dark.warnSoft,
  '#8A4B0C': dark.warnText,
  '#C2413A': dark.bad,
  '#FBE6E3': dark.badSoft,
  '#A8322C': '#FF8A80',
  '#2D6B4B': '#2F8A5E',
  '#E8D9C2': '#4A3C2E',
  '#F3E6D2': '#33281D',
  '#CDB89B': '#6B5844',
  '#7A4A12': dark.warnText,
  '#8A5A00': dark.warnText,
  '#FEE2E2': dark.badSoft,
  // رماديات الويب المستعملة في النوافذ (تميل للأزرق) ← درجات بنية دافئة
  '#F3F4F6': dark.tint,
  '#EEF2FF': dark.cream,
  '#374151': '#E4D6C6',
  '#4B5563': '#C9B8A6',
  '#DC2626': '#FF8A80',
});

configurePalette({
  colors: {
    primary: light.burnt,
    primaryHover: light.burntDeep,
    primaryLight: light.cream,
    background: light.page,
    surface: '#FFFFFF',
    border: light.line,
    text: light.ink,
    textMuted: light.inkSoft,
    placeholder: '#A8937E',
    success: light.ok,
    successLight: light.okSoft,
    warning: light.amber,
    error: light.bad,
    errorDark: '#A8322C',
    errorLight: light.badSoft,
  },
  brand: {
    ink: light.ink,
    offer: light.burnt,
    offerEnd: light.amber,
    gold: light.amber,
    goldLight: light.cream,
    goldBorder: light.amber,
    goldText: light.warnText,
    surfaceMuted: light.tint,
  },
  dark: {
    colors: {
      primary: dark.burnt,
      primaryHover: dark.burntDeep,
      primaryLight: dark.cream,
      background: dark.page,
      surface: '#211A14',
      border: dark.line,
      text: dark.ink,
      textMuted: dark.inkSoft,
      placeholder: '#7F6E5E',
      success: dark.ok,
      successLight: dark.okSoft,
      warning: dark.amber,
      error: dark.bad,
      errorDark: '#FF8A80',
      errorLight: dark.badSoft,
    },
    brand: {
      ink: dark.ink,
      offer: dark.burnt,
      offerEnd: dark.amber,
      gold: dark.amber,
      goldLight: dark.warnSoft,
      goldBorder: '#8A5A00',
      goldText: dark.warnText,
      surfaceMuted: dark.tint,
    },
  },
});
