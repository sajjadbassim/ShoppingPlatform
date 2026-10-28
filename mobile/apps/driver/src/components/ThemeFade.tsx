import { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { colors, useTheme } from '@wasit/ui';

// تبديل الفاتح/الداكن: يُغطّى التطبيق بلون خلفية المظهر السابق ثم يتلاشى ببطء،
// فيظهر المظهر الجديد بنعومة بدل القفز المفاجئ
export function ThemeFade() {
  const mode = useTheme();
  const lastBackground = useRef(colors.background);
  const first = useRef(true);
  const opacity = useRef(new Animated.Value(0)).current;
  const [from, setFrom] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      lastBackground.current = colors.background;
      return;
    }
    setFrom(lastBackground.current);
    lastBackground.current = colors.background;
    opacity.setValue(1);
    Animated.timing(opacity, { toValue: 0, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setFrom(null);
    });
  }, [mode, opacity]);

  if (!from) return null;
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: from, opacity, zIndex: 9999, elevation: 9999 }]} />;
}
