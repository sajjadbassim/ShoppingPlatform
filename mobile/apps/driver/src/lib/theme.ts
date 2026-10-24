import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchMyPreferences, updateMyPreferences, useSessionStore } from '@wasit/shared';
import { setThemeMode, type ThemeMode } from '@wasit/ui';

const KEY = 'theme-mode';

const isMode = (v: unknown): v is ThemeMode => v === 'light' || v === 'dark';

// يُقرأ المحفوظ على الجهاز قبل عرض أي شاشة (الافتراضي فاتح كالويب)
export async function loadSavedTheme(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (isMode(saved)) setThemeMode(saved);
  } catch {
    // يبقى الفاتح
  }
}

// تبديل من الإعدادات: يظهر فوراً ويُحفظ على الجهاز وفي الحساب (إن سجّل الدخول) كما في الويب
export function changeTheme(mode: ThemeMode) {
  setThemeMode(mode);
  AsyncStorage.setItem(KEY, mode).catch(() => {});
  if (useSessionStore.getState().signedIn) updateMyPreferences({ theme: mode }).catch(() => {});
}

// بعد الدخول يُطبَّق مظهر الحساب (مصدر الحقيقة، كما في الويب) على هذا الجهاز
export function useAccountTheme() {
  const signedIn = useSessionStore((s) => s.signedIn);
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetchMyPreferences()
      .then((prefs) => {
        if (cancelled || !isMode(prefs.theme)) return;
        setThemeMode(prefs.theme);
        AsyncStorage.setItem(KEY, prefs.theme).catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [signedIn]);
}
