import type { ReactNode } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText, brand, colors, createStyles, radius, useTheme } from '@wasit/ui';
import { palette } from '../lib/palette';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const money = (n?: number | null) => `${Math.round(n || 0).toLocaleString('en-US')} د.ع`;
// رقم داخل نص عربي: العلامة تمنع انقلاب الترتيب (×2 تظهر 2×)
export const ltr = (s: string | number) => `‎${s}`;

// ===== الشاشة: رأس برتقالي ناعم يتلاشى في الخلفية، ومحتوى قابل للتمرير، وشريط سفلي اختياري =====
interface ScreenProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  overlay?: ReactNode;
  // مسافة سفلية لشريط التبويبات
  tabs?: boolean;
}

export function Screen({ title, subtitle, back, right, children, footer, refreshing, onRefresh, scroll = true, tabs, overlay }: ScreenProps) {
  useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, tabs && { paddingBottom: 110 }, !!footer && { paddingBottom: 24 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { flex: 1 }]}>{children}</View>
  );
  return (
    <View style={styles.screen}>
      <LinearGradient colors={[palette.cream, colors.background]} style={styles.glow} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          {back && (
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="رجوع">
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <AppText weight="extraBold" style={{ fontSize: 22 }} numberOfLines={1}>{title}</AppText>
            {!!subtitle && <AppText muted style={{ fontSize: 13 }} numberOfLines={1}>{subtitle}</AppText>}
          </View>
          {right}
        </View>
        {body}
        {footer && <SafeAreaView edges={["bottom"]} style={styles.footer}>{footer}</SafeAreaView>}
        {overlay}
      </SafeAreaView>
    </View>
  );
}

export function Card({ children, tone, onPress, pad = 14 }: { children: ReactNode; tone?: 'warn' | 'ok' | 'bad'; onPress?: () => void; pad?: number }) {
  useTheme();
  const border = tone === 'warn' ? palette.amber : tone === 'ok' ? colors.success : tone === 'bad' ? colors.error : 'transparent';
  const style = [styles.card, { padding: pad, borderColor: border }];
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [...style, pressed && { opacity: 0.85 }]}>{children}</Pressable>
  ) : (
    <View style={style}>{children}</View>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: { label: string; onPress: () => void } }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
      <AppText weight="bold" muted style={{ flex: 1, fontSize: 13 }}>{children}</AppText>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <AppText weight="bold" style={{ color: colors.primaryHover, fontSize: 13 }}>{action.label}</AppText>
        </Pressable>
      )}
    </View>
  );
}

type Tone = 'primary' | 'ok' | 'warn' | 'bad' | 'muted';
const toneColors = (t: Tone) =>
  ({
    primary: [colors.primaryLight, colors.primaryHover],
    ok: [palette.okSoft, '#2D6B4B'],
    warn: [palette.warnSoft, palette.warnText],
    bad: [palette.badSoft, '#A8322C'],
    muted: [brand.surfaceMuted, colors.textMuted],
  })[t];

export function Chip({ label, tone = 'primary' }: { label: string; tone?: Tone }) {
  useTheme();
  const [bg, fg] = toneColors(tone);
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <AppText weight="bold" numberOfLines={1} style={{ fontSize: 12, color: fg }}>{label}</AppText>
    </View>
  );
}

// مربع أيقونة ملوّن (نقاط الدخول في القوائم والبطاقات)
export function IconTile({ icon, tone = 'primary', size = 42 }: { icon: IconName; tone?: Tone; size?: number }) {
  useTheme();
  const [bg, fg] = toneColors(tone);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.34, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.5} color={fg} />
    </View>
  );
}

interface BtnProps {
  title: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'soft' | 'ghost' | 'bad' | 'ok';
  compact?: boolean;
}

export function ActionButton({ title, onPress, icon, disabled, loading, tone = 'primary', compact }: BtnProps) {
  useTheme();
  const solid = tone === 'primary' || tone === 'ok';
  const fg = solid ? '#FFFFFF' : tone === 'bad' ? '#A8322C' : tone === 'soft' ? colors.primaryHover : colors.text;
  const bg = tone === 'primary' ? colors.primaryHover : tone === 'ok' ? '#2D6B4B' : tone === 'soft' ? colors.primaryLight : tone === 'bad' ? palette.badSoft : colors.surface;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        compact && { minHeight: 44, paddingHorizontal: 14 },
        { backgroundColor: bg },
        tone === 'ghost' && { borderWidth: 1.5, borderColor: colors.border },
        (pressed || disabled || loading) && { opacity: 0.6 },
      ]}
    >
      {!!icon && <Ionicons name={icon} size={18} color={fg} />}
      <AppText weight="extraBold" style={{ color: fg, fontSize: compact ? 14 : 16 }}>{loading ? '...' : title}</AppText>
    </Pressable>
  );
}

// ===== تبويبات داخل الشاشة (الكوبونات | العروض) =====
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string; badge?: number }[] }) {
  useTheme();
  return (
    <View style={styles.segWrap}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.seg, on && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <AppText weight={on ? 'extraBold' : 'medium'} style={{ fontSize: 14, color: on ? colors.text : colors.textMuted }}>{o.label}</AppText>
            {!!o.badge && <Chip label={String(o.badge)} tone={on ? 'primary' : 'muted'} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// شرائح فلترة تُمرَّر أفقياً
export function FilterPills<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string; count?: number; alert?: boolean }[] }) {
  useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.pill, on && { backgroundColor: colors.text, borderColor: colors.text }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
            <AppText weight="bold" numberOfLines={1} style={{ fontSize: 13, lineHeight: 22, color: on ? '#FFFFFF' : colors.text }}>{o.label}</AppText>
            {o.count != null && (
              <View style={[styles.pillCount, on ? { backgroundColor: 'rgba(255,255,255,0.22)' } : o.alert ? { backgroundColor: palette.warnSoft } : { backgroundColor: brand.surfaceMuted }]}>
                <AppText weight="bold" style={{ fontSize: 11, color: on ? '#FFFFFF' : o.alert ? palette.warnText : colors.textMuted }}>{o.count}</AppText>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ToggleRow({ title, desc, value, onChange, disabled }: { title: string; desc?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <AppText weight="bold" style={{ fontSize: 15 }}>{title}</AppText>
        {!!desc && <AppText muted style={{ fontSize: 12.5, lineHeight: 20 }}>{desc}</AppText>}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFFFFF" />
    </View>
  );
}

// صف قائمة: أيقونة ونص وسهم
export function ListRow({ icon, tone, title, subtitle, badge, onPress, last }: { icon: IconName; tone?: Tone; title: string; subtitle?: string; badge?: { label: string; tone?: Tone }; onPress: () => void; last?: boolean }) {
  useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: brand.surfaceMuted }, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <IconTile icon={icon} tone={tone} size={38} />
      <View style={{ flex: 1 }}>
        <AppText weight="bold" style={{ fontSize: 15 }}>{title}</AppText>
        {!!subtitle && <AppText muted style={{ fontSize: 12.5 }}>{subtitle}</AppText>}
      </View>
      {badge && <Chip label={badge.label} tone={badge.tone ?? 'warn'} />}
      <Ionicons name="chevron-back" size={18} color={colors.placeholder} />
    </Pressable>
  );
}

export function Empty({ icon, text, action }: { icon: IconName; text: string; action?: { label: string; onPress: () => void } }) {
  useTheme();
  return (
    <View style={styles.empty}>
      <IconTile icon={icon} tone="muted" size={64} />
      <AppText muted style={{ textAlign: 'center', lineHeight: 24 }}>{text}</AppText>
      {action && <ActionButton title={action.label} onPress={action.onPress} compact />}
    </View>
  );
}

export const callPhone = (phone?: string | null) => phone && Linking.openURL(`tel:${phone}`);

// رقم عراقي محلي ← دولي لروابط واتساب
export const whatsappUrl = (phone?: string | null): string | null => {
  const digits = (phone || '').replace(/\D/g, '');
  const intl = digits.startsWith('0') ? `964${digits.slice(1)}` : digits;
  return intl ? `https://wa.me/${intl}` : null;
};

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  content: { padding: 16, paddingTop: 4, gap: 12 },
  footer: { backgroundColor: colors.surface, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', gap: 10 },
  card: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1.5, gap: 10, shadowColor: '#7A4A12', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  chip: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, minHeight: 52, paddingHorizontal: 18, flex: 1 },
  segWrap: { flexDirection: 'row', backgroundColor: '#F3E6D2', borderRadius: 18, padding: 4 },
  seg: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42, borderRadius: 14 },
  segOn: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pillCount: { minWidth: 20, paddingHorizontal: 6, borderRadius: radius.full, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 44, paddingHorizontal: 20 },
}));
