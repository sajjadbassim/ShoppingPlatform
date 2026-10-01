import plugin from 'tailwindcss/plugin'
import { themeColors, themeVars } from './theme.palette.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // الوضع الداكن يُفعَّل بإضافة الصنف "dark" إلى <html>
  darkMode: 'class',
  theme: {
    extend: {
      // الألوان معرّفة كمتغيرات CSS في theme.palette.js (فاتح/داكن)
      colors: themeColors,
      fontFamily: {
        sans: ['Tajawal', 'system-ui', 'sans-serif'],
        display: ['Cairo', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      maxWidth: {
        'container': '1440px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.1)',
        'dropdown': '0 10px 40px rgba(0, 0, 0, 0.15)',
        'modal': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      },
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        'full': '9999px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-out': 'fadeOut 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'spin-slow': 'spin 2s linear infinite',
        // زر العروض في الشريط السفلي
        'wiggle': 'wiggle 2.5s ease-in-out infinite',
        'soft-ping': 'softPing 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        // زر الريلز في الهيدر
        'gradient-x': 'gradientX 4s ease infinite',
        // شريط التحميل العلوي
        'loading-bar': 'loadingBar 8s cubic-bezier(0.1, 0.6, 0.3, 1) forwards',
      },
      keyframes: {
        wiggle: {
          '0%, 60%, 100%': { transform: 'rotate(0deg) scale(1)' },
          '10%': { transform: 'rotate(-14deg) scale(1.1)' },
          '20%': { transform: 'rotate(12deg) scale(1.1)' },
          '30%': { transform: 'rotate(-8deg) scale(1.05)' },
          '40%': { transform: 'rotate(6deg) scale(1.05)' },
          '50%': { transform: 'rotate(0deg) scale(1)' },
        },
        loadingBar: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        softPing: {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '80%, 100%': { transform: 'scale(1.45)', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      transitionDuration: {
        '200': '200ms',
      },
    },
  },
  plugins: [
    // متغيرات الألوان: الوضع الفاتح على :root والداكن على .dark
    // .theme-static يعيد ألوان الوضع الفاتح لعناصر داكنة أصلاً (مثل الفوتر) حتى لا تنقلب
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...themeVars.light, colorScheme: 'light' },
        '.dark': { ...themeVars.dark, colorScheme: 'dark' },
        '.theme-static': themeVars.light,
      })
    }),
  ],
}
