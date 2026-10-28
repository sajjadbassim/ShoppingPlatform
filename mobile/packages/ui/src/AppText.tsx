import { Text, type TextProps, StyleSheet } from 'react-native';
import { safeLineHeight } from '@wasit/shared';
import { colors, fonts, createStyles, useTheme } from './theme';

type Weight = 'regular' | 'medium' | 'bold' | 'extraBold';

interface Props extends TextProps {
  weight?: Weight;
  muted?: boolean;
}

// سقف تكبير الخط تبعاً لإعدادات الهاتف. التطبيق الذي يستدعي setMaxFontScale (مثل البائع) يحمي تخطيطه من حجم خط 1.3 فأكثر؛
// وبلا استدعاء يبقى الافتراضي (بلا سقف) كما كان
let maxFontScale: number | undefined;
export const setMaxFontScale = (value: number | undefined) => {
  maxFontScale = value;
};

// خط Tajawal يُختار بالاسم لا بـfontWeight (لا يدعم الخط الوزن عبر الخاصية على أندرويد)
export function AppText({ weight = 'regular', muted, style, ...rest }: Props) {
  useTheme();
  const flat = StyleSheet.flatten(style) ?? {};
  const lineHeight = safeLineHeight(flat.fontSize, flat.lineHeight);
  return (
    <Text
      maxFontSizeMultiplier={maxFontScale}
      {...rest}
      style={[styles.base, { fontFamily: fonts[weight] }, muted && styles.muted, style, lineHeight != null && { lineHeight }]}
    />
  );
}

const styles = createStyles(() => ({
  base: { color: colors.text, fontSize: 16, textAlign: 'left' },
  muted: { color: colors.textMuted },
}));
