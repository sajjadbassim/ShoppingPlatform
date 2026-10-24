import { useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, colors, createStyles, useTheme } from '@wasit/ui';
import { ActionButton, Card } from '../components/kit';
import { requestTrackingPermission, startTracking } from '../lib/tracking';
import { toast } from '../lib/toast';

// شاشة الشرح قبل إذن الموقع الدائم: يطلبها المراجعون ويحتاجها المندوب ليفهم لماذا يُطلب
export default function LocationPermissionScreen() {
  useTheme();
  const [busy, setBusy] = useState(false);

  const allow = async () => {
    setBusy(true);
    try {
      const result = await requestTrackingPermission();
      if (result === 'always') {
        await startTracking();
        toast.success('تم تفعيل التتبّع أثناء الدوام');
        router.back();
      } else if (result === 'foreground') {
        toast.warning('اختر «السماح طوال الوقت» من إعدادات الموقع ليعمل التتبّع والتطبيق في الخلفية', { duration: 6000 });
        Linking.openSettings();
      } else {
        toast.warning('لم يُمنح إذن الموقع');
      }
    } catch {
      toast.error('تعذّر طلب الإذن');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name="location" size={44} color={colors.primary} />
        </View>
        <AppText weight="extraBold" style={{ fontSize: 22, textAlign: 'center' }}>لماذا نطلب موقعك طوال الوقت؟</AppText>
        <Card>
          <AppText style={{ lineHeight: 26 }}>
            نتتبّع موقعك <AppText weight="bold">أثناء دوامك فقط</AppText> ليرى الزبون أين طلبه، ولتصلك الطلبات الأقرب إليك.
          </AppText>
          <AppText muted style={{ fontSize: 13, lineHeight: 22 }}>• يتوقف التتبّع عند اختيار «استراحة» أو «غير متصل».</AppText>
          <AppText muted style={{ fontSize: 13, lineHeight: 22 }}>• يظهر إشعار دائم «أنت في الخدمة» ما دام التتبّع يعمل.</AppText>
          <AppText muted style={{ fontSize: 13, lineHeight: 22 }}>• لا نشارك موقعك مع أي جهة خارج المنصة.</AppText>
        </Card>
        <AppText muted style={{ textAlign: 'center', fontSize: 13 }}>في الخطوة التالية اختر «السماح طوال الوقت».</AppText>
      </View>
      <View style={styles.footer}>
        <ActionButton title="متابعة وإعطاء الإذن" loading={busy} onPress={allow} />
        <ActionButton title="لاحقاً" tone="ghost" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, justifyContent: 'center', gap: 16, padding: 20 },
  icon: { alignSelf: 'center', width: 88, height: 88, borderRadius: 28, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 20, gap: 10 },
}));
