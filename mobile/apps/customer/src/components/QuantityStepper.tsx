import { Pressable, StyleSheet, View } from 'react-native';
import { formatQuantity } from '@wasit/shared';
import { AppText, colors, radius, createStyles, useTheme } from '@wasit/ui';

interface Props {
  value: number;
  min?: number;
  max: number;
  weightStepKg?: number | null;
  disabled?: boolean;
  onChange: (value: number) => void;
}

// عدّاد كمية: بالوحدة، وللبيع بالوزن يعرض «1.5 كغم» بدل عدد الوحدات
export function QuantityStepper({ value, min = 1, max, weightStepKg, disabled, onChange }: Props) {
  useTheme();
  const canDec = !disabled && value > min;
  const canInc = !disabled && value < max;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => canDec && onChange(value - 1)}
        disabled={!canDec}
        style={[styles.button, !canDec && styles.off]}
        accessibilityLabel="إنقاص الكمية"
        hitSlop={6}
      >
        <AppText weight="bold" style={styles.symbol}>
          −
        </AppText>
      </Pressable>
      <AppText weight="bold" style={styles.value}>
        {formatQuantity(value, weightStepKg)}
      </AppText>
      <Pressable
        onPress={() => canInc && onChange(value + 1)}
        disabled={!canInc}
        style={[styles.button, !canInc && styles.off]}
        accessibilityLabel="زيادة الكمية"
        hitSlop={6}
      >
        <AppText weight="bold" style={styles.symbol}>
          +
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = createStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  button: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { borderColor: colors.border },
  symbol: { color: colors.primary, fontSize: 20, lineHeight: 24 },
  value: { minWidth: 56, textAlign: 'center', fontSize: 16 },
}));
