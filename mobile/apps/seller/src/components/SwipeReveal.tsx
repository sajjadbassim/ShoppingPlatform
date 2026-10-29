import { useRef, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, colors } from '@wasit/ui';

const WIDTH = 88;
const OPEN_AT = 40;

// بطاقة تُسحب يميناً أو يساراً فيظهر زر على الجهة المسحوبة. السحب بـPanResponder و Animated المدمجين (بلا وحدة native)
// الواجهة عربية (RTL): left/right ينعكسان فنستعمل start/end. الزر شكل فقط حالياً: onPress اختياري
export function SwipeReveal({ children, label = 'حذف', icon = 'trash-outline', onPress }: { children: ReactNode; label?: string; icon?: React.ComponentProps<typeof Ionicons>['name']; onPress?: () => void }) {
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(0);

  const settle = (to: number) => {
    open.current = to;
    Animated.spring(x, { toValue: to, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  };

  const pan = useRef(
    PanResponder.create({
      // نلتقط الحركة الأفقية قبل البطاقة (Pressable) والقائمة (ScrollView) ولا نتركها لهما، والعمودية تبقى للتمرير
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderMove: (_, g) => x.setValue(Math.max(-WIDTH, Math.min(WIDTH, open.current + g.dx))),
      onPanResponderRelease: (_, g) => {
        const end = open.current + g.dx;
        settle(end > OPEN_AT ? WIDTH : end < -OPEN_AT ? -WIDTH : 0);
      },
      onPanResponderTerminate: () => settle(open.current),
    }),
  ).current;

  const button = (side: 'left' | 'right') => (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute', top: 0, bottom: 0, width: WIDTH, ...(side === 'left' ? { end: 0 } : { start: 0 }),
        opacity: x.interpolate({ inputRange: side === 'left' ? [0, 12] : [-12, 0], outputRange: side === 'left' ? [0, 1] : [1, 0], extrapolate: 'clamp' }),
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => { onPress?.(); settle(0); }}
        style={{ flex: 1, borderRadius: 16, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', gap: 4 }}
      >
        <Ionicons name={icon} size={24} color="#FFFFFF" />
        <AppText weight="bold" style={{ color: '#FFFFFF', fontSize: 13 }}>{label}</AppText>
      </Pressable>
    </Animated.View>
  );

  return (
    <View>
      {button('left')}
      {button('right')}
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}
