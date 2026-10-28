import { configurePalette, setTextScale } from '@wasit/ui';

// خط Tajawal كبير بصرياً؛ يُصغَّر كل نص في التطبيق بنسبة ثابتة بدل تعديل كل شاشة
setTextScale(0.88);

// هوية تطبيق المندوب: برتقالي مع فحمي داكن. وضعان: فاتح كريمي وداكن فحمي، بلوحتين صريحتين
// (الداكن لا يُشتق من لوحة الويب). تُستورد أولاً في _layout قبل رسم أي شاشة
configurePalette({
  colors: {
    primary: '#F26A21',
    primaryHover: '#D9560F',
    primaryLight: '#FFE9DB',
    background: '#FFF8F2',
    surface: '#FFFFFF',
    border: '#F0E3D8',
    text: '#1C1410',
    textMuted: '#7A6A5E',
    placeholder: '#B3A397',
    success: '#1E9E6A',
    successLight: '#DDF4E9',
    warning: '#D98A00',
    error: '#D8453B',
    errorDark: '#B8342B',
    errorLight: '#FDE4E1',
  },
  brand: {
    ink: '#1C1410',
    surfaceMuted: '#F6EBE0',
    goldLight: '#FDEFD2',
    goldText: '#9A5B00',
  },
  dark: {
    colors: {
      primary: '#FF7A2F',
      primaryHover: '#E8651A',
      primaryLight: '#3A2315',
      background: '#141414',
      surface: '#1F1F1F',
      border: '#2C2C2C',
      text: '#F5F5F5',
      textMuted: '#A1A1A1',
      placeholder: '#6E6E6E',
      success: '#3DDC97',
      successLight: '#12352A',
      warning: '#FFB020',
      error: '#FF6B5E',
      errorDark: '#FF6B5E',
      errorLight: '#3A1D1A',
    },
    brand: {
      ink: '#F5F5F5',
      surfaceMuted: '#2A2A2A',
      goldLight: '#3A2B0C',
      goldText: '#FFB020',
    },
  },
});
