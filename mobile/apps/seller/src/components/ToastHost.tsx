import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText, colors, createStyles, useTheme } from '@wasit/ui';
import { dismissToast, subscribeToasts, type ToastItem, type ToastType } from '../lib/toast';

const TYPES: Record<ToastType, { bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { bg: colors.success, icon: 'checkmark-circle-outline' },
  error: { bg: colors.error, icon: 'alert-circle-outline' },
  warning: { bg: colors.warning, icon: 'warning-outline' },
  info: { bg: '#3B82F6', icon: 'information-circle-outline' },
};

// ارتفاع الشريط السفلي (التبويبات أو شريط الإضافة للسلة) كي لا يغطيه الإشعار
const BOTTOM_BAR = 64;

function ToastView({ item }: { item: ToastItem }) {
  useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const config = TYPES[item.type];

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const timer = setTimeout(close, item.duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => dismissToast(item.id));

  return (
    <Animated.View
      accessibilityRole="alert"
      style={[
        styles.toast,
        { backgroundColor: config.bg, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
      ]}
    >
      <Ionicons name={config.icon} size={22} color={colors.white} />
      <View style={{ flex: 1 }}>
        {!!item.title && (
          <AppText weight="bold" style={styles.title}>
            {item.title}
          </AppText>
        )}
        <AppText weight="medium" style={styles.message}>
          {item.message}
        </AppText>
      </View>
      <Pressable onPress={close} hitSlop={10} accessibilityLabel="إغلاق">
        <Ionicons name="close" size={20} color={colors.white} />
      </Pressable>
    </Animated.View>
  );
}

// يُركَّب مرة واحدة في الجذر
export function ToastHost() {
  useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setItems), []);
  if (items.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + BOTTOM_BAR + 12 }]}>
      {items.map((t) => (
        <ToastView key={t.id} item={t} />
      ))}
    </View>
  );
}

const styles = createStyles(() => ({
  host: { position: 'absolute', start: 16, end: 16, gap: 8, zIndex: 200, elevation: 20 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  title: { color: colors.white, fontSize: 15 },
  message: { color: colors.white, fontSize: 14 },
}));
