import { StyleSheet, View } from 'react-native';
import { orderStatusAr, orderStatusTone, type StatusTone } from '@wasit/shared';
import { AppText, colors, createStyles, createThemed, radius, tc, useTheme } from '@wasit/ui';

const TONES = createThemed<Record<StatusTone, { bg: string; fg: string }>>(() => ({
  info: { bg: colors.primaryLight, fg: colors.primary },
  warning: { bg: tc('#FEF3C7'), fg: tc('#B45309') },
  success: { bg: colors.successLight, fg: tc('#047857') },
  error: { bg: colors.errorLight, fg: colors.errorDark },
}));

// block: شارة بعرض كامل (رأس تفاصيل الطلب)
export function StatusBadge({ status, block }: { status: string; block?: boolean }) {
  useTheme();
  const tone = TONES[orderStatusTone(status)];
  return (
    <View style={[styles.badge, block && styles.block, { backgroundColor: tone.bg }]}>
      <AppText weight="bold" style={{ color: tone.fg, fontSize: 13 }}>
        {orderStatusAr(status)}
      </AppText>
    </View>
  );
}

const styles = createStyles(() => ({
  block: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 6 },
  badge: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
}));
