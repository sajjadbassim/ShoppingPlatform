import { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { initSession, useSessionStore } from '@wasit/shared';
import { colors, useAppFonts, useTheme } from '@wasit/ui';
import { persistOptions, queryClient } from '../api/queryClient';
import { useOrdersRealtime } from '../api/useOrders';
import { OfflineBanner } from '../components/OfflineBanner';
import { DialogHost } from '../components/DialogHost';
import { ToastHost } from '../components/ToastHost';
import { UpdateGate } from '../components/UpdateGate';
import { ProductActionsProvider } from '../components/ProductActions';
import { usePushNotifications } from '../lib/pushNotifications';
import { loadSavedTheme, useAccountTheme } from '../lib/theme';

// يربط التحديث الحي بحالة الدخول (يحتاج أن يكون داخل QueryClientProvider)
function RealtimeBridge() {
  useOrdersRealtime();
  usePushNotifications();
  return null;
}

// ألوان التنقل (خلفية الشاشات أثناء الانتقال) من لوحة التطبيق
function navigationTheme(mode: 'light' | 'dark') {
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.surface, text: colors.text, border: colors.border },
  };
}

export default function RootLayout() {
  const sessionReady = useSessionStore((s) => s.ready);
  const signedIn = useSessionStore((s) => s.signedIn);
  const fontsLoaded = useAppFonts();
  const theme = useTheme();
  const [themeReady, setThemeReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  useAccountTheme();

  // المظهر المحفوظ يُطبَّق قبل عرض أي شاشة حتى لا يومض الفاتح أولاً
  useEffect(() => {
    loadSavedTheme().finally(() => setThemeReady(true));
  }, []);

  useEffect(() => {
    // أي فشل في قراءة الجلسة يعني «زائر»، ولا يُبقي الشاشة سوداء
    initSession().catch(() => useSessionStore.setState({ ready: true, signedIn: false }));
    // شبكة أمان أخيرة: لا ننتظر أكثر من 4 ثوانٍ مهما حدث
    const timer = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  // الخروج يمسح بيانات المستخدم السابق من الذاكرة (سلته وعناوينه ونقاطه) حتى لا تظهر لمن يدخل بعده
  useEffect(() => {
    if (signedIn) return;
    for (const key of ['cart', 'addresses', 'loyalty-estimate', 'delivery-slots', 'orders', 'order', 'order-tracking', 'notifications', 'notifications-unread', 'wishlist', 'loyalty-account', 'referral', 'loyalty-transactions', 'returns']) {
      queryClient.removeQueries({ queryKey: [key] });
    }
  }, [signedIn]);

  // ننتظر قراءة الرموز وتحميل الخط قبل عرض أي شاشة، بحدّ أقصى 4 ثوانٍ
  if (!timedOut && (!sessionReady || !fontsLoaded || !themeReady)) return null;

  return (
    <ThemeProvider value={navigationTheme(theme)}>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <RealtimeBridge />
      <ProductActionsProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {/* شاشات الدخول للزائر فقط: بعد الدخول تزول تلقائياً ويعود المستخدم للرئيسية */}
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ presentation: 'modal' }} />
          <Stack.Screen name="register" options={{ presentation: 'modal' }} />
          <Stack.Screen name="forgot-password" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
      </ProductActionsProvider>
      <OfflineBanner />
      <ToastHost />
      <DialogHost />
      <UpdateGate />
    </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
