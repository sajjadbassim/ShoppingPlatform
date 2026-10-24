import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, fonts, radius, spacing, createStyles, useTheme } from './theme';

interface Props extends TextInputProps {
  label: string;
  error?: string;
  // true لحقل كلمة المرور: يُضاف زر إظهار/إخفاء
  secure?: boolean;
  // true للأرقام والبريد: يُكتب من اليسار لليمين (مثل dir="ltr" في الويب)
  ltr?: boolean;
  // أيقونة في بداية الحقل (كما في الويب: مستخدم، قفل، بريد)
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

export function Input({ label, error, secure, ltr, icon, style, ...rest }: Props) {
  useTheme();
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <AppText weight="medium" style={styles.label}>
        {label}
      </AppText>
      <View style={[styles.box, focused && styles.focused, !!error && styles.errorBox]}>
        {!!icon && <Ionicons name={icon} size={22} color={colors.placeholder} />}
        <TextInput
          {...rest}
          secureTextEntry={secure && hidden}
          placeholderTextColor={colors.placeholder}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, ltr && styles.ltr, style]}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8} accessibilityLabel="إظهار أو إخفاء كلمة المرور">
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.placeholder} />
          </Pressable>
        )}
      </View>
      {!!error && <AppText style={styles.error}>{error}</AppText>}
    </View>
  );
}

const styles = createStyles(() => ({
  wrapper: { gap: spacing.xs },
  label: { fontSize: 14, color: colors.text },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    gap: spacing.sm,
  },
  focused: { borderColor: colors.primary },
  errorBox: { borderColor: colors.error },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text, paddingVertical: 10, textAlign: 'left' },
  // في RTL يصبح 'left' هو بداية السطر (يمين)، فنفرض اتجاه الكتابة للأرقام والبريد
  ltr: { writingDirection: 'ltr' },
  toggle: { color: colors.primary, fontSize: 14 },
  error: { color: colors.errorDark, fontSize: 13 },
}));
