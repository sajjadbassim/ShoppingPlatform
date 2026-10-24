import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, createStyles, tc, useTheme } from './theme';

interface Props {
  value: number;
  size?: number;
  // بلا onChange يكون للعرض فقط
  onChange?: (value: number) => void;
}

// نجوم التقييم: للعرض (متوسط) أو للإدخال (اضغط نجمة)
export function StarRating({ value, size = 18, onChange }: Props) {
  useTheme();
  return (
    <View style={styles.row} accessibilityLabel={`التقييم ${value} من 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = (
          <AppText style={{ fontSize: size, lineHeight: size + 6, color: n <= Math.round(value) ? tc('#F59E0B') : colors.border }}>★</AppText>
        );
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={4} accessibilityLabel={`${n} نجوم`}>
            {star}
          </Pressable>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
    </View>
  );
}

const styles = createStyles(() => ({ row: { flexDirection: 'row', gap: 2 } }));
