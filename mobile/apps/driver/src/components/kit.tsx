import type { ReactNode } from 'react';
import { Linking, Pressable, ScrollView, View, type RefreshControlProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText, brand, colors, createStyles, radius, tc, useTheme } from '@wasit/ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// أجزاء واجهة صغيرة يعاد استعمالها في شاشات المندوب

export const money = (n?: number | null) => `${Math.round(n || 0).toLocaleString('en-US')} د.ع`;

export function Screen({ title, children, refreshControl, right }: { title: string; children: ReactNode; refreshControl?: React.ReactElement<RefreshControlProps>; right?: ReactNode }) {
  useTheme();
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <AppText weight="extraBold" style={{ fontSize: 22, flex: 1 }}>{title}</AppText>
        {right}
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={refreshControl}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, tone }: { children: ReactNode; tone?: 'warn' | 'ok' | 'bad' }) {
  useTheme();
  return <View style={[styles.card, tone === 'warn' && { borderColor: colors.warning }, tone === 'ok' && { borderColor: colors.success }, tone === 'bad' && { borderColor: colors.error }]}>{children}</View>;
}

export function Chip({ label, tone = 'primary' }: { label: string; tone?: 'primary' | 'ok' | 'warn' | 'bad' | 'muted' }) {
  useTheme();
  const map = {
    primary: [colors.primaryLight, colors.primary],
    ok: [colors.successLight, tc('#047857')],
    warn: [tc('#FEF3C7'), tc('#B45309')],
    bad: [colors.errorLight, colors.errorDark],
    muted: [brand.surfaceMuted, colors.textMuted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <AppText weight="bold" style={{ fontSize: 12, color: fg }}>{label}</AppText>
    </View>
  );
}

export function ActionButton({ title, icon, onPress, tone = 'primary', disabled, loading }: { title: string; icon?: IconName; onPress: () => void; tone?: 'primary' | 'ok' | 'bad' | 'ghost'; disabled?: boolean; loading?: boolean }) {
  useTheme();
  const bg = tone === 'ok' ? colors.success : tone === 'bad' ? colors.errorLight : tone === 'ghost' ? colors.surface : colors.primary;
  const fg = tone === 'bad' ? colors.errorDark : tone === 'ghost' ? colors.primary : tone === 'ok' ? '#06281E' : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg }, tone === 'ghost' && { borderWidth: 1, borderColor: colors.border }, (pressed || disabled || loading) && { opacity: 0.6 }]}
    >
      {!!icon && <Ionicons name={icon} size={18} color={fg} />}
      <AppText weight="bold" style={{ color: fg, fontSize: 15 }}>{loading ? '...' : title}</AppText>
    </Pressable>
  );
}

export const callPhone = (phone?: string | null) => phone && Linking.openURL(`tel:${phone}`);

export function PhoneRow({ phone }: { phone?: string | null }) {
  useTheme();
  if (!phone) return null;
  return (
    <Pressable onPress={() => callPhone(phone)} style={styles.phone} accessibilityRole="link">
      <Ionicons name="call-outline" size={16} color={colors.primary} />
      <AppText style={{ color: colors.primary, fontSize: 14, writingDirection: 'ltr' }}>{'‎'}{phone}</AppText>
    </Pressable>
  );
}

export function Empty({ icon, text }: { icon: IconName; text: string }) {
  useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={colors.placeholder} />
      <AppText muted style={{ textAlign: 'center' }}>{text}</AppText>
    </View>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  content: { padding: 16, paddingTop: 4, gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  chip: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 14 },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 48 },
}));
