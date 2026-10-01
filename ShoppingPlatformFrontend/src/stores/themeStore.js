import { create } from 'zustand';

// المظهر يُحفظ محلياً حتى يُطبَّق فوراً قبل ظهور الصفحة (انظر السكربت في index.html)،
// ويُزامَن مع تفضيلات المستخدم على الخادم عبر useThemeSync
const STORAGE_KEY = 'theme';

// نفس لون السطح في theme.palette.js — لون شريط المتصفح على الهاتف
const THEME_COLORS = { light: '#4F46E5', dark: '#151B27' };

const readStoredTheme = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const applyTheme = (theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
};

export const useThemeStore = create((set) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    if (theme !== 'light' && theme !== 'dark') return;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // التخزين غير متاح (وضع التصفح الخاص) — يبقى المظهر لهذه الجلسة فقط
    }
    applyTheme(theme);
    set({ theme });
  },
}));

export default useThemeStore;
