import { useCallback, useEffect, useState } from 'react';
import { Animated, AppState, Linking, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { canReceiveOrders, displayWorkStatus, logout } from '@wasit/shared';
import { AppText, colors, createStyles, radius, useTheme } from '@wasit/ui';
import { useDriverProfile } from '../../api/useDriver';
import { ActionButton, Card, Chip, money, Screen } from '../../components/kit';
import { FadeIn, FloatingOrb, LiveDot, Shimmer, useBlendedColor, useCountUp } from '../../components/live';
import { confirmDialog } from '../../lib/dialog';
import { changeTheme } from '../../lib/theme';
import { getTrackingPermission, type TrackingPermission } from '../../lib/tracking';

export default function AccountScreen() {
  const dark = useTheme() === 'dark';
  const { data: me } = useDriverProfile();
  const [permission, setPermission] = useState<TrackingPermission | null>(null);

  const refresh = useCallback(() => getTrackingPermission().then(setPermission).catch(() => {}), []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const working = canReceiveOrders(me?.workStatus);
  const current = displayWorkStatus(me?.workStatus);
  // نفس تبدّل لون بطاقة الطلبات بحسب الحالة (متاح برتقالي، استراحة كهرماني، غير متصل رمادي)
  const heroBg = useBlendedColor(current === 'available' ? 0 : current === 'break' ? 1 : 2, [colors.primary, '#C98A12', '#5E5E66']);
  const [heroWidth, setHeroWidth] = useState(360);
  const deliveries = useCountUp(me?.totalDeliveries ?? 0);
  const cashShown = useCountUp(Math.round(me?.cashInHand ?? 0));

  return (
    <Screen title="حسابي">
      <FadeIn>
      <Animated.View style={[styles.hero, { backgroundColor: heroBg }]} onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)}>
        <FloatingOrb size={150} style={{ top: -50, end: -40 }} />
        <FloatingOrb size={90} style={{ bottom: -30, start: -20 }} delay={1200} />
        <Shimmer width={heroWidth} />
        <View style={styles.avatar}>
          <AppText style={{ fontSize: 27, lineHeight: 36 }}>🛵</AppText>
          <View style={styles.avatarDot}>
            <LiveDot color={working ? '#7CF0B8' : '#FFFFFF'} size={7} active={working} />
          </View>
        </View>
        <AppText weight="extraBold" style={{ fontSize: 17, color: colors.white }}>{me?.fullName ?? '...'}</AppText>
        <AppText style={{ writingDirection: 'ltr', color: 'rgba(255,255,255,0.88)' }}>{'‎'}{me?.phone}</AppText>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <AppText weight="extraBold" style={{ fontSize: 16, color: colors.white }}>{Number(me?.rating ?? 0).toFixed(1)} ★</AppText>
            <AppText style={styles.statLabel}>التقييم</AppText>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <AppText weight="extraBold" style={{ fontSize: 16, color: colors.white }}>{deliveries.toLocaleString('en-US')}</AppText>
            <AppText style={styles.statLabel}>توصيلة</AppText>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <AppText weight="extraBold" style={{ fontSize: 16, color: colors.white }}>{cashShown.toLocaleString('en-US')}</AppText>
            <AppText style={styles.statLabel}>نقد بعهدتك</AppText>
          </View>
        </View>
      </Animated.View>
      </FadeIn>

      <Card>
        <View style={styles.row}>
          <View style={styles.label}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <AppText weight="medium">تتبّع الموقع</AppText>
          </View>
          {permission === 'always' ? (
            <Chip label={working ? 'يعمل' : 'جاهز'} tone="ok" />
          ) : (
            <Chip label={permission === 'foreground' ? 'يحتاج «طوال الوقت»' : 'غير ممنوح'} tone="warn" />
          )}
        </View>
        {permission !== 'always' && (
          <ActionButton title="إعطاء إذن الموقع" icon="location-outline" tone="ghost" onPress={() => router.push('/location-permission')} />
        )}
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={styles.label}>
            <Ionicons name={dark ? 'moon' : 'sunny-outline'} size={18} color={colors.primary} />
            <AppText weight="medium">الوضع الداكن</AppText>
          </View>
          <Switch value={dark} onValueChange={(v) => changeTheme(v ? 'dark' : 'light')} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
        </View>
      </Card>

      <Card>
        <View style={styles.label}>
          <Ionicons name="battery-charging-outline" size={18} color={colors.primary} />
          <AppText weight="bold">إن توقف التتبّع في الخلفية</AppText>
        </View>
        <AppText muted style={{ fontSize: 13, lineHeight: 22 }}>
          بعض الهواتف، مثل شاومي وسامسونج وأوبو، توقف التطبيقات لتوفير البطارية. افتح إعدادات التطبيق واختر البطارية ثم «بلا قيود».
        </AppText>
        <ActionButton title="فتح إعدادات التطبيق" icon="settings-outline" tone="ghost" onPress={() => Linking.openSettings()} />
      </Card>

      <ActionButton
        title="تسجيل الخروج"
        icon="log-out-outline"
        tone="bad"
        onPress={() =>
          confirmDialog({
            title: 'تسجيل الخروج؟',
            message: 'سيتوقف التتبّع ولن تصلك طلبات جديدة على هذا الهاتف.',
            confirmText: 'خروج',
            tone: 'danger',
            onConfirm: () => logout(),
          })
        }
      />
    </Screen>
  );
}

const styles = createStyles(() => ({
  hero: { borderRadius: radius.xl, padding: 14, gap: 4, alignItems: 'center', overflow: 'hidden' },
  avatarDot: { position: 'absolute', bottom: -6, end: -6, backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 99 },
  avatar: { width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 6, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: radius.lg, paddingVertical: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statLabel: { fontSize: 11.5, color: 'rgba(255,255,255,0.88)' },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTop: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
}));
