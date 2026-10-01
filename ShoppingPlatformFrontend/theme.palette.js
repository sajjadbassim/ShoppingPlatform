// theme.palette.js
// لوحة ألوان الوضع الفاتح والداكن.
// كل لون في Tailwind يشير إلى متغير CSS (مثل --c-gray-900)، وقيمة المتغير تتغير عند إضافة
// الصنف "dark" إلى <html>. بهذا تعمل الأصناف الحالية (bg-gray-50, text-gray-900 ...) في
// الوضعين دون الحاجة لإضافة dark: إلى كل عنصر.
import defaultColors from 'tailwindcss/colors'

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

// العائلات الملوّنة المستخدمة في المشروع (من ألوان Tailwind الافتراضية)
const FAMILIES = [
  'slate', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]

const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
const rgb = (arr) => arr.map(Math.round).join(' ')
// مزج لونين: t = نسبة اللون الثاني
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)

// ===========================
// الألوان المحايدة
// ===========================

const grayLight = {
  50: '#F9FAFB', 100: '#F3F4F6', 200: '#E5E7EB', 300: '#D1D5DB', 400: '#9CA3AF',
  500: '#6B7280', 600: '#4B5563', 700: '#374151', 800: '#1F2937', 900: '#111827', 950: '#030712',
}

// في الوضع الداكن ينقلب التدرج: الخلفيات الفاتحة تصبح داكنة والنصوص الداكنة تصبح فاتحة
const grayDark = {
  50: '#0B0F19', 100: '#1E2532', 200: '#2C3444', 300: '#40495A', 400: '#6E7788',
  500: '#949CAA', 600: '#B0B7C4', 700: '#CBD0D9', 800: '#E1E4EA', 900: '#F1F3F6', 950: '#F9FAFB',
}

// لون البطاقات والأسطح (بديل الأبيض)
const SURFACE_LIGHT = '#FFFFFF'
const SURFACE_DARK = '#151B27'
const surfaceDark = hexToRgb(SURFACE_DARK)

// ===========================
// اللون الأساسي والحالات
// ===========================

const primaryLight = {
  DEFAULT: '#4F46E5', hover: '#4338CA', light: '#EEF2FF',
  50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC', 400: '#818CF8',
  500: '#4F46E5', 600: '#4338CA', 700: '#3730A3', 800: '#312E81', 900: '#1E1B4B',
}

const primaryBase = hexToRgb('#6366F1')
const primaryDark = {
  DEFAULT: '#6366F1', hover: '#4F46E5', light: rgbHex(mix(surfaceDark, primaryBase, 0.18)),
  50: rgbHex(mix(surfaceDark, primaryBase, 0.14)),
  100: rgbHex(mix(surfaceDark, primaryBase, 0.22)),
  200: rgbHex(mix(surfaceDark, primaryBase, 0.32)),
  300: rgbHex(mix(surfaceDark, primaryBase, 0.55)),
  400: '#818CF8', 500: '#6366F1', 600: '#4F46E5',
  700: '#A5B4FC', 800: '#C7D2FE', 900: '#E0E7FF',
}

const statusLight = {
  success: { DEFAULT: '#10B981', light: '#D1FAE5', dark: '#059669' },
  warning: { DEFAULT: '#F59E0B', light: '#FEF3C7', dark: '#D97706' },
  error:   { DEFAULT: '#EF4444', light: '#FEE2E2', dark: '#DC2626' },
  info:    { DEFAULT: '#3B82F6', light: '#DBEAFE', dark: '#2563EB' },
}

const statusDark = Object.fromEntries(
  Object.entries(statusLight).map(([name, c]) => [name, {
    DEFAULT: c.DEFAULT,
    light: rgbHex(mix(surfaceDark, hexToRgb(c.DEFAULT), 0.18)),
    dark: { success: '#34D399', warning: '#FBBF24', error: '#F87171', info: '#60A5FA' }[name],
  }])
)

function rgbHex(arr) {
  return '#' + arr.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

// العائلات الملوّنة في الوضع الداكن:
// الدرجات الفاتحة (خلفيات الشارات) تصبح صبغة داكنة، والدرجات الداكنة (نصوص) تصبح فاتحة،
// والدرجات الوسطى (400-600) تبقى كما هي لأنها تُستخدم للأزرار والأيقونات.
const darkFamily = (c) => {
  const c500 = hexToRgb(c['500'])
  return {
    50: rgbHex(mix(surfaceDark, c500, 0.12)),
    100: rgbHex(mix(surfaceDark, c500, 0.18)),
    200: rgbHex(mix(surfaceDark, c500, 0.28)),
    300: rgbHex(mix(surfaceDark, hexToRgb(c['400']), 0.55)),
    400: c['400'], 500: c['500'], 600: c['600'],
    700: c['400'], 800: c['300'], 900: c['200'], 950: c['100'],
  }
}

// ===========================
// بناء المتغيرات وألوان Tailwind
// ===========================

const lightVars = {}
const darkVars = {}
const colors = {}

const register = (name, key, lightHex, darkHex) => {
  const varName = key === 'DEFAULT' ? `--c-${name}` : `--c-${name}-${key}`
  lightVars[varName] = rgb(hexToRgb(lightHex))
  darkVars[varName] = rgb(hexToRgb(darkHex))
  return `rgb(var(${varName}) / <alpha-value>)`
}

const registerFamily = (name, light, dark) => {
  colors[name] = Object.fromEntries(
    Object.keys(light).map((key) => [key, register(name, key, light[key], dark[key])])
  )
}

registerFamily('gray', grayLight, grayDark)
registerFamily('primary', primaryLight, primaryDark)
Object.keys(statusLight).forEach((name) => registerFamily(name, statusLight[name], statusDark[name]))
FAMILIES.forEach((name) => {
  const light = Object.fromEntries(SHADES.map((s) => [s, defaultColors[name][s]]))
  registerFamily(name, light, darkFamily(defaultColors[name]))
})

colors.surface = register('surface', 'DEFAULT', SURFACE_LIGHT, SURFACE_DARK)

export const themeColors = colors
export const themeVars = { light: lightVars, dark: darkVars }
