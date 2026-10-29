import '../lib/palette';
import { useEffect, useState } from 'react';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { initSession, useSessionStore } from '@wasit/shared';
import { colors, setMaxFontScale, useAppFonts, useTheme } from '@wasit/ui';
import { queryClient } from '../api/queryClient';
import { DialogHost } from '../components/DialogHost';
import { OfflineBanner } from '../components/OfflineBanner';
import { ToastHost } from '../components/ToastHost';
import { usePushNotifications } from '../lib/pushNotifications';

// حجم الخط في الهاتف حتى 1.3 يكبّر البطاقات والأرقام حتى تتبعثر الصفحات؛ نسمح بتكبير خفيف فقط
setMaxFontScale(1.15);

// يربط الإشعارات بحالة الدخول (يحتاج أن يكون داخل QueryClientProvider)
function Bridge() {
  usePushNotifications();
  return null;
}

export default function RootLayout() {
  useTheme();
  const ready = useSessionStore((s) => s.ready);
  const signedIn = useSessionStore((s) => s.signedIn);
  const fontsLoaded = useAppFonts();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // أي فشل في قراءة الجلسة يعني «زائر»، ولا يُبقي الشاشة فارغة
    initSession().catch(() => useSessionStore.setState({ ready: true, signedIn: false }));
    const timer = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  // الخروج يمسح بيانات المتجر السابق من الذاكرة
  useEffect(() => {
    if (!signedIn) queryClient.clear();
  }, [signedIn]);

  if (!timedOut && (!ready || !fontsLoaded)) return null;

  const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: colors.primary, background: colors.background, card: colors.surface, text: colors.text, border: colors.border } };

  return (
    <ThemeProvider value={navTheme}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Bridge />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="login" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="order/[id]" />
            <Stack.Screen name="product/[id]" />
            <Stack.Screen name="product/variants/[id]" />
            <Stack.Screen name="reviews" />
            <Stack.Screen name="promotions" />
            <Stack.Screen name="reports" />
            <Stack.Screen name="social" />
            <Stack.Screen name="social-post/[id]" />
            <Stack.Screen name="publish/[id]" />
            <Stack.Screen name="staff" />
            <Stack.Screen name="activity" />
            <Stack.Screen name="settings/index" />
            <Stack.Screen name="settings/hours" />
          </Stack.Protected>
        </Stack>
        <OfflineBanner />
        <ToastHost />
        <DialogHost />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
