import { useSyncExternalStore } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { darkHex } from '@wasit/shared';

// الألوان من theme.palette.js في الويب. الوضع الداكن يُشتق منه بالجدول نفسه (darkMap.ts)، فيطابق الويب.
export type ThemeMode = 'light' | 'dark';

const lightColors = {
  primary: '#4F46E5',
  primaryHover: '#4338CA',
  primaryLight: '#EEF2FF',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  textMuted: '#6B7280',
  placeholder: '#9CA3AF',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  error: '#EF4444',
  errorDark: '#DC2626',
  errorLight: '#FEE2E2',
  white: '#FFFFFF',
};

const lightBrand = {
  ink: '#111827',
  offer: '#EF4444',
  offerEnd: '#F97316',
  grocery: '#10B981',
  groceryEnd: '#0D9488',
  reels: ['#F97316', '#EC4899', '#C026D3'],
  gold: '#FBBF24',
  goldLight: '#FEF9C3',
  goldBorder: '#FDE68A',
  goldText: '#B45309',
  surfaceMuted: '#F3F4F6',
};

export type Palette = typeof lightColors;
export type Brand = typeof lightBrand;

const WHITE = '#FFFFFF';

// الألوان الدلالية: كائن واحد متغيّر يُحدَّث عند تبديل الوضع (تقرأه الأنماط عند أول رسم وكل مكوّن عند رسمه)
export const colors: Palette = { ...lightColors };
export const brand: Brand = { ...lightBrand };

// لوحة داكنة صريحة يحددها التطبيق (المندوب)؛ ما لم يحدده يُشتق من الفاتح بالجدول المشترك كما في الويب
const customDarkColors: Partial<Palette> = {};
const customDarkBrand: Partial<Brand> = {};

const applyPalette = (mode: ThemeMode) => {
  const dark = mode === 'dark';
  for (const key of Object.keys(lightColors) as (keyof Palette)[]) {
    const custom = customDarkColors[key];
    colors[key] = dark ? (custom ?? (key === 'white' ? WHITE : darkHex(lightColors[key]))) : lightColors[key];
  }
  for (const key of Object.keys(lightBrand) as (keyof Brand)[]) {
    const value = lightBrand[key];
    const custom = customDarkBrand[key];
    // التدرجات (مصفوفات) وألوان الهوية الصريحة (عروض، سوبرماركت) تبقى كما هي
    (brand as Record<string, unknown>)[key] = dark ? (custom ?? (typeof value === 'string' ? darkHex(value) : value)) : value;
  }
};

// ===== مخزن الوضع الحالي =====
let mode: ThemeMode = 'light';
const listeners = new Set<() => void>();

// تطبيق له هوية لونية مختلفة (البائع): يستبدل قيم الوضع الفاتح قبل رسم أي شاشة.
// الجدول الداكن مبني على لوحة الويب، فالتطبيق الذي يغيّر لوحته يبقى فاتحاً فقط
export function configurePalette(next: { colors?: Partial<Palette>; brand?: Partial<Brand>; dark?: { colors?: Partial<Palette>; brand?: Partial<Brand> } }) {
  Object.assign(lightColors, next.colors);
  Object.assign(lightBrand, next.brand);
  Object.assign(customDarkColors, next.dark?.colors);
  Object.assign(customDarkBrand, next.dark?.brand);
  applyPalette(mode);
  listeners.forEach((l) => l());
}

export const getThemeMode = (): ThemeMode => mode;
export const isDarkTheme = () => mode === 'dark';

export function setThemeMode(next: ThemeMode) {
  if (next === mode) return;
  mode = next;
  applyPalette(next);
  listeners.forEach((l) => l());
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};
const getSnapshot = () => mode;

// كل مكوّن يستعمل الألوان يستدعي هذا الخطاف ليُعاد رسمه عند تبديل الوضع
export function useTheme(): ThemeMode {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// لون مباشر (داخل JSX أو منطق): فاتح كما كُتب، وفي الداكن بمقابله من الجدول. الأبيض يبقى أبيض (نص على لون)
export const tc = (value: string): string => (mode === 'dark' ? darkHex(value, true) : value);

// ===== الأنماط حسب الوضع =====
const BACKGROUND_PROPS = /^(backgroundColor|border(Top|Bottom|Left|Right|Start|End)?Color)$/;
const COLOR_PROPS = /(^color$|Color$)/;

// أزرار وشرائح «الحبر» (#111827/#1F2937 كخلفية بنص أبيض): لو انقلبت فاتحة اختفى النص الأبيض، فتصير رمادياً داكناً مرئياً
const INK_BACKGROUNDS = new Set(['#111827', '#1F2937']);
const INK_DARK = '#40495A';

// rgba(255,255,255,a) (أبيض شفاف كخلفية) يصير السطح الداكن بالشفافية نفسها
const WHITE_RGBA = /^rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)$/i;

function mapStyleObject(style: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [prop, value] of Object.entries(style)) {
    if (typeof value === 'string' && COLOR_PROPS.test(prop) && prop !== 'shadowColor') {
      const isBackground = BACKGROUND_PROPS.test(prop);
      const white = WHITE_RGBA.exec(value);
      if (white && isBackground) out[prop] = `rgba(21, 27, 39, ${white[1]})`;
      else if (isBackground && INK_BACKGROUNDS.has(value.toUpperCase())) out[prop] = INK_DARK;
      else out[prop] = darkHex(value, !isBackground);
    } else {
      out[prop] = value;
    }
  }
  return out;
}

// بديل StyleSheet.create: تُعرَّف الأنماط داخل دالة تُنفَّذ كسولاً لكل وضع (فتقرأ colors الحالية)،
// وفي الداكن تُحوَّل الألوان السداسية المكتوبة مباشرة (#F3F4F6...) بالجدول. الاستعمال كما هو: styles.card
type AnyStyle = ViewStyle | TextStyle | ImageStyle;

export function createStyles<S extends { [key: string]: AnyStyle }>(factory: () => S & { [key: string]: AnyStyle }): Readonly<S> {
  const cache: Partial<Record<ThemeMode, Readonly<S>>> = {};
  const resolve = (): Readonly<S> => {
    const cached = cache[mode];
    if (cached) return cached;
    const raw = factory() as Record<string, Record<string, unknown>>;
    const styles = mode === 'dark' ? Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, mapStyleObject(v)])) : raw;
    const resolved = StyleSheet.create(styles as never) as Readonly<S>;
    cache[mode] = resolved;
    return resolved;
  };
  return new Proxy({} as Readonly<S>, { get: (_target, key) => resolve()[key as keyof S] });
}


// جدول ألوان ثابت يعتمد على الوضع (مثل ألوان حالات الطلب): يُحسب كسولاً لكل وضع فتُقرأ colors/tc الحالية
export function createThemed<T extends object>(factory: () => T): T {
  const cache: Partial<Record<ThemeMode, T>> = {};
  const resolve = (): T => (cache[mode] ??= factory());
  return new Proxy({} as T, {
    get: (_t, key) => (resolve() as Record<string | symbol, unknown>)[key],
    has: (_t, key) => key in resolve(),
    ownKeys: () => Reflect.ownKeys(resolve()),
    getOwnPropertyDescriptor: (_t, key) => {
      const d = Object.getOwnPropertyDescriptor(resolve(), key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 6, md: 8, lg: 12, xl: 16, full: 9999 } as const;

// أسماء الخطوط كما تسجّلها useAppFonts (Tajawal كخط النصوص في الويب)
export const fonts = {
  regular: 'Tajawal_400Regular',
  medium: 'Tajawal_500Medium',
  bold: 'Tajawal_700Bold',
  extraBold: 'Tajawal_800ExtraBold',
} as const;
