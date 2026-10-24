import { Linking, Platform, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { fetchAppVersion, isUpdateRequired } from '@wasit/shared';
import { AppText, Button, colors, radius, spacing, createStyles, useTheme } from '@wasit/ui';

// حاجز التحديث الإجباري: إن كان إصدار التطبيق أقدم من أقل إصدار يحدده الخادم تُغطّى الشاشات برسالة تحديث.
// فشل الفحص (لا إنترنت/خطأ خادم) لا يمنع أحداً من استعمال التطبيق
export function UpdateGate() {
  useTheme();
  const current = Constants.expoConfig?.version ?? '0.0.0';
  const { data } = useQuery({
    queryKey: ['app-version'],
    queryFn: () => fetchAppVersion('customer', Platform.OS === 'ios' ? 'ios' : 'android'),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  if (!isUpdateRequired(current, data)) return null;

  return (
    <View style={styles.cover}>
      <View style={styles.icon}>
        <Ionicons name="cloud-download-outline" size={40} color={colors.primary} />
      </View>
      <AppText weight="extraBold" style={{ fontSize: 24, textAlign: 'center' }}>
        يتوفر تحديث جديد
      </AppText>
      <AppText muted style={{ fontSize: 15, textAlign: 'center', lineHeight: 26 }}>
        هذا الإصدار قديم ولم يعد مدعوماً. حدّث التطبيق للمتابعة.
      </AppText>
      {!!data?.storeUrl && <Button title="تحديث الآن" onPress={() => Linking.openURL(data.storeUrl!)} style={{ alignSelf: 'stretch' }} />}
    </View>
  );
}

const styles = createStyles(() => ({
  cover: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, zIndex: 1000 },
  icon: { width: 88, height: 88, borderRadius: radius.full, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
}));
