import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, radius, spacing, createStyles, useTheme } from './theme';

interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  error?: string;
}

export function Checkbox({ checked, onChange, label, error }: Props) {
  useTheme();
  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        style={styles.row}
      >
        <View style={[styles.box, checked && styles.boxChecked, !!error && styles.boxError]}>
          {checked && <AppText weight="bold" style={styles.tick}>✓</AppText>}
        </View>
        <AppText style={styles.label}>{label}</AppText>
      </Pressable>
      {!!error && <AppText style={styles.error}>{error}</AppText>}
    </View>
  );
}

const styles = createStyles(() => ({
  wrapper: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  boxError: { borderColor: colors.error },
  tick: { color: colors.white, fontSize: 14, lineHeight: 18 },
  label: { flex: 1, fontSize: 14 },
  error: { color: colors.errorDark, fontSize: 13 },
}));
