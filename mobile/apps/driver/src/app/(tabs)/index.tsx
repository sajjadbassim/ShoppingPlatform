import { Animated, Pressable, RefreshControl, View } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  canReceiveOrders,
  newestFirst,
  displayWorkStatus,
  formatClock,
  WORK_STATUSES,
  type DriverOrder,
  type WorkStatus,
} from '@wasit/shared';
import { AppText, colors, createStyles, radius, useTheme } from '@wasit/ui';
import { useDriverActions, useDriverOrders, useDriverProfile, useRefreshDriver } from '../../api/useDriver';
import { Card, ChipFilter, Chip, Empty, money, Screen } from '../../components/kit';
import { FadeIn, FloatingOrb, LiveDot, Shimmer, useBlendedColor, useCountUp } from '../../components/live';
import { toast } from '../../lib/toast';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const orderChip = (o: DriverOrder) =>
  o.status === 'DELIVERED'
    ? { label: 'سُلّم', tone: 'ok' as const }
    : o.status === 'DELIVERY_FAILED'
      ? { label: 'تعذّر التسليم', tone: 'bad' as const }
      : o.allPickedUp
        ? { label: 'في الطريق للزبون', tone: 'primary' as const }
        : { label: 'بانتظار الاستلام', tone: 'warn' as const };

const STATUS_UI = {
  available: { icon: 'flash' as const, color: colors.success, text: '#06281E' },
  break: { icon: 'cafe' as const, color: colors.warning, text: '#3B2A00' },
  offline: { icon: 'power' as const, color: '#6B7280', text: '#FFFFFF' },
};

function Tile({ icon, tint, label, value, unit }: { icon: IconName; tint: string; label: string; value: number; unit: string }) {
  const shown = useCountUp(value);
  return (
    <View style={[styles.tile, { flex: 1 }]}>
      <View style={[styles.tileIcon, { backgroundColor: tint + '26' }]}>
        <Ionicons name={icon} size={15} color={tint} />
      </View>
      <AppText muted style={{ fontSize: 12 }}>{label}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <AppText weight="extraBold" style={{ fontSize: 20 }}>{shown.toLocaleString('en-US')}</AppText>
        {!!unit && <AppText muted style={{ fontSize: 12 }}>{unit}</AppText>}
      </View>
    </View>
  );
}

function WorkStatusCard() {
  useTheme();
  const { data: me } = useDriverProfile();
  const { workStatus } = useDriverActions();
  const current = displayWorkStatus(me?.workStatus);

  const change = (value: WorkStatus) => {
    if (value === current || workStatus.isPending) return;
    workStatus.mutate(value, { onError: (e) => toast.error((e as { message?: string }).message || 'تعذّر تغيير الحالة') });
  };

  const statusIndex = current === 'available' ? 0 : current === 'break' ? 1 : 2;
  const heroBg = useBlendedColor(statusIndex, [colors.primary, '#C98A12', '#5E5E66']);
  const [heroWidth, setHeroWidth] = useState(360);

  return (
    <>
      <FadeIn>
        <Animated.View style={[styles.hero, { backgroundColor: heroBg }]} onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)}>
        <FloatingOrb size={150} style={{ top: -50, end: -40 }} />
        <FloatingOrb size={90} style={{ bottom: -30, start: -20 }} delay={1200} />
        <Shimmer width={heroWidth} />
        <View style={styles.row}>
          <View style={styles.heroAvatar}>
            <AppText style={{ fontSize: 19, lineHeight: 26 }}>🛵</AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText style={styles.heroMuted}>مرحباً</AppText>
            <AppText weight="extraBold" numberOfLines={1} style={{ color: colors.white, fontSize: 17 }}>{me?.fullName ?? '...'}</AppText>
          </View>
          <View style={styles.livePill}>
            <LiveDot color={current === 'available' ? '#7CF0B8' : '#FFFFFF'} active={current === 'available'} />
            <AppText weight="bold" style={{ fontSize: 12.5, color: colors.white }}>{current === 'offline' ? 'غير متصل' : current === 'break' ? 'استراحة' : 'متصل'}</AppText>
          </View>
        </View>
        <View style={styles.seg}>
          {WORK_STATUSES.map((st) => {
            const on = current === st.value;
            const ui = STATUS_UI[st.value];
            return (
              <Pressable key={st.value} onPress={() => change(st.value)} style={[styles.segItem, on && { backgroundColor: ui.color }]} accessibilityRole="button">
                <Ionicons name={ui.icon} size={16} color={on ? ui.text : colors.white} />
                <AppText weight="bold" style={{ fontSize: 12.5, color: on ? ui.text : colors.white }}>{st.label}</AppText>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.heroNote}>
          <Ionicons name={canReceiveOrders(me?.workStatus) ? 'location' : 'information-circle-outline'} size={15} color="rgba(255,255,255,0.85)" />
          <AppText style={[styles.heroMuted, { flex: 1 }]}>
            {canReceiveOrders(me?.workStatus) ? 'الموقع مشارَك أثناء الدوام فقط' : 'غيّر حالتك إلى «متاح» لتستقبل الطلبات'}
          </AppText>
        </View>
        </Animated.View>
      </FadeIn>
      <FadeIn delay={120}>
      <View style={styles.row}>
        <Tile icon="checkmark-done" tint={colors.success} label="سلّمت اليوم" value={me?.deliveredToday ?? 0} unit="طلب" />
        <Tile icon="cash-outline" tint={colors.warning} label="نقد بحوزتك (د.ع)" value={Math.round(me?.cashInHand ?? 0)} unit="" />
      </View>
      </FadeIn>
    </>
  );
}

export default function OrdersScreen() {
  useTheme();
  const [status, setStatus] = useState<'pickup' | 'road' | 'all'>('all');
  const orders = useDriverOrders(false);
  const refreshAll = useRefreshDriver();
  const all = newestFirst(orders.data ?? [], (o) => o.assignedAt);
  const list = all.filter((o) => status === 'all' || (status === 'pickup' ? !o.allPickedUp : o.allPickedUp));

  return (
    <Screen title="الطلبات" refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={refreshAll} />}>
      <WorkStatusCard />
      <ChipFilter options={[{ value: 'pickup', label: 'بانتظار الاستلام' }, { value: 'road', label: 'في الطريق' }, { value: 'all', label: 'الكل' }] as const} value={status} onChange={setStatus} />
      <AppText weight="bold" style={{ fontSize: 15 }}>طلبات مسندة إليك · {list.length}</AppText>
      {list.length === 0 && !orders.isLoading && (
        <Empty icon="cube-outline" text={status === 'all' ? 'ستظهر هنا الطلبات فور إسنادها إليك. المسلَّمة في تبويب النقد' : 'لا طلبات تطابق هذا الفلتر'} />
      )}
      {list.map((o) => {
        const chip = orderChip(o);
        const accent = { ok: colors.success, bad: colors.error, primary: colors.primary, warn: colors.warning }[chip.tone];
        return (
          <Pressable key={o.orderId} onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.orderId } })} style={({ pressed }) => pressed && { opacity: 0.85 }}>
            <Card accent={accent}>
              <View style={styles.row}>
                <AppText weight="bold" style={{ writingDirection: 'ltr' }}>{o.orderNumber}</AppText>
                <Chip label={chip.label} tone={chip.tone} />
              </View>
              <View style={styles.line}>
                <Ionicons name="person-outline" size={16} color={colors.textMuted} />
                <AppText weight="medium" style={{ flex: 1 }}>{o.customerName}</AppText>
              </View>
              <View style={styles.line}>
                <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                <AppText muted style={{ fontSize: 13, flex: 1 }} numberOfLines={2}>{[o.zoneName, o.address].filter(Boolean).join('، ')}</AppText>
              </View>
              <View style={[styles.row, styles.foot]}>
                <AppText muted style={{ fontSize: 13 }}>{o.stores.length} {o.stores.length === 1 ? 'متجر' : 'متاجر'} · {formatClock(o.assignedAt)}</AppText>
                <AppText weight="extraBold" style={{ fontSize: 15, color: o.amountToCollect > 0 ? colors.text : colors.success }}>{o.amountToCollect > 0 ? money(o.amountToCollect) : 'مدفوع'}</AppText>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = createStyles(() => ({
  hero: { borderRadius: radius.xl, padding: 14, gap: 12, overflow: 'hidden' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: radius.full, paddingStart: 4, paddingEnd: 12, paddingVertical: 2 },
  heroAvatar: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  heroMuted: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5 },
  heroNote: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: radius.lg, padding: 3, gap: 3 },
  segItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, borderRadius: radius.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  foot: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  tile: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 2 },
  tileIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
}));
