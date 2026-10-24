import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { AppText } from './AppText';
import { colors, radius, createStyles, useTheme } from './theme';

interface Props extends Omit<PressableProps, 'children'> {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
}

export function Button({ title, loading, variant = 'primary', disabled, style, ...rest }: Props) {
  useTheme();
  const outline = variant === 'outline';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={(state) => [
        styles.base,
        outline ? styles.outline : variant === 'danger' ? styles.danger : styles.primary,
        state.pressed && { opacity: 0.85 },
        (disabled || loading) && { opacity: 0.6 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={outline ? colors.primary : colors.white} />
      ) : (
        <AppText weight="bold" style={{ color: outline ? colors.primary : colors.white }}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = createStyles(() => ({
  base: { minHeight: 54, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primary: { backgroundColor: colors.primary },
  danger: { backgroundColor: colors.error },
  outline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.primary },
}));
