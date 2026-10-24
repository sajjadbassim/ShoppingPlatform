import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOnlineStatus } from '../api/useOnlineStatus';
import { AppText, createStyles, tc, useTheme } from '@wasit/ui';

// شريط يظهر أعلى الشاشة عند انقطاع الإنترنت: البيانات المعروضة آخر ما حُفظ على الجهاز
export function OfflineBanner() {
  useTheme();
  const online = useOnlineStatus();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View pointerEvents="none" style={[styles.bar, { paddingTop: insets.top + 4 }]}>
      <Ionicons name="cloud-offline-outline" size={16} color={tc("#FFFFFF")} />
      <AppText weight="medium" style={styles.text}>
        لا يوجد اتصال بالإنترنت — تُعرض آخر بيانات محفوظة
      </AppText>
    </View>
  );
}

const styles = createStyles(() => ({
  bar: { position: 'absolute', top: 0, start: 0, end: 0, zIndex: 100, backgroundColor: '#374151', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 6 },
  text: { color: '#FFFFFF', fontSize: 12 },
}));
