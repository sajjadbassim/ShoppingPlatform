import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DAY_NAMES, describeDay, fullSchedule, todayInBaghdad, type WorkingDay } from '@wasit/shared';
import { AppText, colors, createStyles, tc, useTheme } from '@wasit/ui';

// أوقات عمل المتجر مع تمييز اليوم الحالي (StoreHoursList في الويب)
export function StoreHours({ hours }: { hours?: WorkingDay[] | null }) {
  useTheme();
  if (!hours?.length) return null;
  const today = todayInBaghdad();
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.title}>
        <Ionicons name="time-outline" size={15} color={colors.primary} />
        <AppText weight="bold" style={{ fontSize: 14, color: tc('#1F2937') }}>
          أوقات العمل
        </AppText>
      </View>
      {fullSchedule(hours).map((d) => (
        <View key={d.day} style={styles.row}>
          <AppText weight={d.day === today ? 'bold' : 'regular'} style={[styles.text, d.day === today && styles.today]}>
            {DAY_NAMES[d.day]}
          </AppText>
          <AppText weight={d.day === today ? 'bold' : 'regular'} style={[styles.text, d.day === today && styles.today]}>
            {describeDay(d)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = createStyles(() => ({
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  text: { fontSize: 14, color: '#4B5563' },
  today: { color: '#111827' },
}));
