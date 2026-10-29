import type { ReactNode } from 'react';
import { Linking, Platform, Pressable, ScrollView, View, type RefreshControlProps } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { mapsUrl } from '@wasit/shared';
import { AppText, brand, colors, createStyles, radius, useTheme } from '@wasit/ui';
import { useUnreadCount } from '../api/useNotifications';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// أجزاء واجهة صغيرة يعاد استعمالها في شاشات المندوب

export const money = (n?: number | null) => `${Math.round(n || 0).toLocaleString('en-US')} د.ع`;

// زر الإشعارات في ترويسة كل تبويب، بشارة عدد غير المقروء
export function NotificationBell() {
  useTheme();
  const unread = useUnreadCount();
  return (
    <Pressable onPress={() => router.push('/notifications')} hitSlop={8} accessibilityRole="button" accessibilityLabel={unread ? `الإشعارات، ${unread} جديد` : 'الإشعارات'} style={styles.bell}>
      <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={21} color={unread ? colors.primary : colors.text} />
      {unread > 0 && (
        <View style={styles.bellBadge}>
          <AppText weight="bold" style={{ fontSize: 10, lineHeight: 14, color: colors.white }}>{unread > 9 ? '9+' : unread}</AppText>
        </View>
      )}
    </Pressable>
  );
}

// أيقونة الحساب في الترويسة: «حسابي» خرج من الشريط السفلي ليتّسع لزر مسح الباركود
export function AccountButton() {
  useTheme();
  return (
    <Pressable onPress={() => router.navigate('/account')} hitSlop={8} accessibilityRole="button" accessibilityLabel="حسابي" style={styles.bell}>
      <Ionicons name="person-outline" size={21} color={colors.text} />
    </Pressable>
  );
}

export function Screen({ title, children, refreshControl, right }: { title: string; children: ReactNode; refreshControl?: React.ReactElement<RefreshControlProps>; right?: ReactNode }) {
  useTheme();
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <AppText weight="extraBold" style={{ fontSize: 21, flex: 1 }}>{title}</AppText>
        {right ?? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <NotificationBell />
            {title !== 'حسابي' && <AccountButton />}
          </View>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={refreshControl}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, tone, accent }: { children: ReactNode; tone?: 'warn' | 'ok' | 'bad'; accent?: string }) {
  useTheme();
  return <View style={[styles.card, !!accent && { borderStartWidth: 4, borderStartColor: accent }, tone === 'warn' && { borderColor: colors.warning }, tone === 'ok' && { borderColor: colors.success }, tone === 'bad' && { borderColor: colors.error }]}>{children}</View>;
}

export function Chip({ label, tone = 'primary' }: { label: string; tone?: 'primary' | 'ok' | 'warn' | 'bad' | 'muted' }) {
  useTheme();
  const map = {
    primary: [colors.primaryLight, colors.primary],
    ok: [colors.successLight, colors.success],
    warn: [brand.goldLight, brand.goldText],
    bad: [colors.errorLight, colors.error],
    muted: [brand.surfaceMuted, colors.textMuted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <AppText weight="bold" style={{ fontSize: 11.5, color: fg }}>{label}</AppText>
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
      {!!icon && <Ionicons name={icon} size={16} color={fg} />}
      <AppText weight="bold" style={{ color: fg, fontSize: 14 }}>{loading ? '...' : title}</AppText>
    </Pressable>
  );
}

// رابط geo: يجعل أندرويد يعرض كل تطبيقات الخرائط المثبّتة (Waze وغيره) بدل الذهاب مباشرة إلى خرائط Google
// كما يفعل رابط https. وإن لم يوجد تطبيق يعالجه نعود لرابط الويب
export const openNavigation = (o: { latitude?: number | null; longitude?: number | null; address?: string | null }) => {
  const hasPoint = !!o.latitude && !!o.longitude;
  const query = encodeURIComponent(o.address ?? '');
  const url =
    Platform.OS === 'ios'
      ? hasPoint ? `http://maps.apple.com/?daddr=${o.latitude},${o.longitude}` : `http://maps.apple.com/?q=${query}`
      : hasPoint ? `geo:${o.latitude},${o.longitude}?q=${o.latitude},${o.longitude}` : `geo:0,0?q=${query}`;
  Linking.openURL(url).catch(() => Linking.openURL(mapsUrl(o)));
};

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
      <Ionicons name={icon} size={36} color={colors.placeholder} />
      <AppText muted style={{ textAlign: 'center' }}>{text}</AppText>
    </View>
  );
}

// صف شرائح اختيار واحد (فلتر الفترة أو الحالة)، يتمرّر أفقياً إن ضاق
export function ChipFilter<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: value === o.value }} style={[styles.filter, value === o.value && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          <AppText weight="bold" style={{ fontSize: 12.5, color: value === o.value ? colors.white : colors.textMuted }}>{o.label}</AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = createStyles(() => ({
  filters: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  filter: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  bell: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: -4, end: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  content: { padding: 16, paddingTop: 2, paddingBottom: 110, gap: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 6 },
  chip: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 2 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.lg, paddingVertical: 9, paddingHorizontal: 12 },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 32 },
}));
