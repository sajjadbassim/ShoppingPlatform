import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, createStyles, useTheme } from '@wasit/ui';

// الشريط الثابت أسفل السلة وإتمام الطلب (مكان الشريط السفلي في الهاتف): ظل خفيف وحاشية آمنة
export function StickyBar({ children }: { children: ReactNode }) {
  useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

const styles = createStyles(() => ({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
  },
  row: { height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
}));
