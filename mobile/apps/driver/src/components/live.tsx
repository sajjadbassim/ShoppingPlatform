import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';

// أرقام تصعد من قيمتها السابقة إلى الجديدة بدل أن تقفز
export function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = Date.now();
    const begin = from.current;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setValue(Math.round(begin + (target - begin) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// دخول متدرّج: ينزلق من الأسفل ويتلاشى للوضوح
export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 450, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [progress, delay]);
  return (
    <Animated.View style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

// نقطة «مباشر»: حلقة تتسع وتتلاشى حول نقطة ثابتة
export function LiveDot({ color = '#FFFFFF', size = 8, active = true }: { color?: string; size?: number; active?: boolean }) {
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [ring, active]);
  return (
    <View style={{ width: size * 2.6, height: size * 2.6, alignItems: 'center', justifyContent: 'center' }}>
      {active && (
        <Animated.View
          style={{ position: 'absolute', width: size, height: size, borderRadius: size, backgroundColor: color, opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] }}
        />
      )}
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

// دائرة زخرفية شفافة تطفو ببطء داخل البطاقة
export function FloatingOrb({ size, style, delay = 0 }: { size: number; style: object; delay?: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 3800, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 3800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: 'rgba(255,255,255,0.13)',
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
          ],
        },
        style,
      ]}
    />
  );
}

// لمعة مائلة تعبر البطاقة كل بضع ثوانٍ
export function Shimmer({ width }: { width: number }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(x, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -20,
        bottom: -20,
        width: 60,
        backgroundColor: 'rgba(255,255,255,0.14)',
        transform: [{ rotate: '18deg' }, { translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-120, width + 120] }) }],
      }}
    />
  );
}

// لون يتبدّل بنعومة عند تغيّر الحالة
export function useBlendedColor(index: number, colorsList: string[]) {
  const v = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: index, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [index, v]);
  return v.interpolate({ inputRange: colorsList.map((_, i) => i), outputRange: colorsList });
}
