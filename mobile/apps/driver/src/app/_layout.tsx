import { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { initSession, useSessionStore } from '@wasit/shared';
import { colors, useAppFonts, useTheme } from '@wasit/ui';
import { queryClient } from '../api/queryClient';
import { DialogHost } from '../components/DialogHost';
import { OfflineBanner } from '../components/OfflineBanner';
import { ToastHost } from '../components/ToastHost';
import { usePushNotifications } from '../lib/pushNotifications';
import { loadSavedTheme, useAccountTheme } from '../lib/theme';
import { useTrackingSync } from '../lib/useTrackingSync';
import '../lib/tracking';

// ألوان التنقل (خلفية الشاشات أثناء الانتقال) من لوحة التطبيق
function navigationTheme(mode: 'light' | 'dark') {
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.surface, text: colors.text, border: colors.border },
  };
}

// يربط الإشعارات والتتبّع بحالة الدخول (يحتاج أن يكون داخل QueryClientProvider)
function Bridge() {
  usePushNotifications();
  useTrackingSync();
  return null;
}

export default function RootLayout() {
  const theme = useTheme();
  const ready = useSessionStore((s) => s.ready);
  const signedIn = useSessionStore((s) => s.signedIn);
  const fontsLoaded = useAppFonts();
  const [timedOut, setTimedOut] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  useAccountTheme();

  // المظهر المحفوظ يُطبَّق قبل عرض أي شاشة حتى لا يومض الفاتح أولاً
  useEffect(() => {
    loadSavedTheme().finally(() => setThemeReady(true));
  }, []);

  useEffect(() => {
    // أي فشل في قراءة الجلسة يعني «زائر»، ولا يُبقي الشاشة سوداء
    initSession().catch(() => useSessionStore.setState({ ready: true, signedIn: false }));
    const timer = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  // الخروج يمسح بيانات المندوب السابق من الذاكرة
  useEffect(() => {
    if (!signedIn) queryClient.clear();
  }, [signedIn]);

  if (!timedOut && (!ready || !fontsLoaded || !themeReady)) return null;

  return (
    <ThemeProvider value={navigationTheme(theme)}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <Bridge />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="login" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="order/[id]" />
            <Stack.Screen name="location-permission" options={{ presentation: 'modal' }} />
          </Stack.Protected>
        </Stack>
        <OfflineBanner />
        <ToastHost />
        <DialogHost />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
