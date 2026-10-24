import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

// حركات الويب (tailwind.config.js: wiggle و softPing) — تتوقف لمن فعّل «تقليل الحركة» في جهازه

const useReduceMotion = () => {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
};

const useLoop = (duration: number, easing: (t: number) => number, enabled: boolean) => {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [value, duration, easing, enabled]);
  return value;
};

// اهتزاز الأيقونة كل 2.5 ثانية: ميلان يمين ويسار مع تكبير خفيف ثم سكون
export function Wiggle({ children }: { children: ReactNode }) {
  const reduce = useReduceMotion();
  const t = useLoop(2500, Easing.inOut(Easing.ease), !reduce);
  const rotate = t.interpolate({
    inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1],
    outputRange: ['0deg', '-14deg', '12deg', '-8deg', '6deg', '0deg', '0deg'],
  });
  const scale = t.interpolate({ inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1], outputRange: [1, 1.1, 1.1, 1.05, 1.05, 1, 1] });
  return <Animated.View style={reduce ? undefined : { transform: [{ rotate }, { scale }] }}>{children}</Animated.View>;
}

// نبض: دائرة تتسع وتتلاشى كل ثانيتين خلف العنصر
export function SoftPing({ style }: { style: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const t = useLoop(2000, Easing.bezier(0, 0, 0.2, 1), !reduce);
  if (reduce) return null;
  const scale = t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1.45, 1.45] });
  const opacity = t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.55, 0, 0] });
  return <Animated.View pointerEvents="none" style={[style, { opacity, transform: [{ scale }] }]} />;
}

// قفز (animate-bounce في Tailwind): يرتفع قليلاً بتباطؤ ثم يعود بتسارع، بمدة وتأخير يحددهما الاستخدام
export function Bounce({ children, duration = 1000, delay = 0, style }: {
  children: ReactNode;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration: duration / 2, easing: Easing.bezier(0.8, 0, 1, 1), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: duration / 2, easing: Easing.bezier(0, 0, 0.2, 1), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration, delay, reduce]);
  const translateY = value.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  return <Animated.View style={[style, !reduce && { transform: [{ translateY }] }]}>{children}</Animated.View>;
}
