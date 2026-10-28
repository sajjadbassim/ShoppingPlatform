import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import { AppText } from '@wasit/ui';
import { palette } from '../lib/palette';

// أرقام تصعد من قيمتها السابقة إلى الجديدة بدل أن تقفز (تعطي إحساساً أن اللوحة حيّة)
export function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = Date.now();
    const begin = from.current;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(begin + (target - begin) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// دخول متدرّج عند أول ظهور: ينزلق من الأسفل ويتلاشى للوضوح، والتأخير يرتّب الأقسام واحداً بعد الآخر
export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [progress, delay]);
  return (
    <Animated.View style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

// نبض خفيف يلفت النظر لما ينتظر قراراً
export function Pulse({ active, children }: { active: boolean; children: ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.018, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

// نقطة «مباشر»: حلقة تتسع وتتلاشى حول نقطة ثابتة
export function LiveDot({ color = '#6FCBA6', size = 9 }: { color?: string; size?: number }) {
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [ring]);
  return (
    <View style={{ width: size * 2.4, height: size * 2.4, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{ position: 'absolute', width: size, height: size, borderRadius: size, backgroundColor: color, opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }] }}
      />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

const DAY_LETTER = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']; // الأحد أولاً كما يعدّها JS

// أعمدة مبيعات آخر الأيام داخل البطاقة؛ اليوم الأخير بلون أوضح وكل عمود ينمو من القاع عند الظهور
export function MiniBars({ days }: { days: { date: string; revenue: number }[] }) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, { toValue: 1, duration: 700, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [grow]);
  const max = Math.max(1, ...days.map((d) => d.revenue));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 62 }}>
      {days.map((d, i) => {
        const last = i === days.length - 1;
        const h = Math.max(4, Math.round((d.revenue / max) * 40));
        const letter = DAY_LETTER[new Date(d.date).getDay()] ?? '';
        return (
          <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Animated.View
              style={{ width: '100%', borderRadius: 6, height: grow.interpolate({ inputRange: [0, 1], outputRange: [4, h] }), backgroundColor: last ? '#FFFFFF' : 'rgba(255,255,255,0.38)' }}
            />
            <AppText weight={last ? 'bold' : 'regular'} style={{ fontSize: 11, color: last ? '#FFFFFF' : palette.cream }}>{letter}</AppText>
          </View>
        );
      })}
    </View>
  );
}
