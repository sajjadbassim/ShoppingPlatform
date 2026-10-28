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

// معامل تصغير/تكبير كل نصوص التطبيق (الافتراضي 1 = بلا تغيير). يستدعيه تطبيق يريد خطاً أصغر (مثل المندوب)
let textScale = 1;
export const setTextScale = (value: number) => {
  textScale = value;
};

// خط Tajawal يُختار بالاسم لا بـfontWeight (لا يدعم الخط الوزن عبر الخاصية على أندرويد)
export function AppText({ weight = 'regular', muted, style, ...rest }: Props) {
  useTheme();
  const flat = StyleSheet.flatten(style) ?? {};
  const scaled = textScale === 1 ? undefined : Math.round((flat.fontSize ?? 16) * textScale * 2) / 2;
  const lineHeight = safeLineHeight(scaled ?? flat.fontSize, flat.lineHeight != null && scaled ? Math.round(flat.lineHeight * textScale) : flat.lineHeight);
  return (
    <Text
      maxFontSizeMultiplier={maxFontScale}
      {...rest}
      style={[styles.base, { fontFamily: fonts[weight] }, muted && styles.muted, style, scaled != null && { fontSize: scaled }, lineHeight != null && { lineHeight }]}
    />
  );
}

const styles = createStyles(() => ({
  base: { color: colors.text, fontSize: 16, textAlign: 'left' },
  muted: { color: colors.textMuted },
}));
