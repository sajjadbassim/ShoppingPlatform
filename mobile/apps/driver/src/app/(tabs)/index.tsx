import { Pressable, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
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
import { Card, Chip, Empty, money, Screen } from '../../components/kit';
import { toast } from '../../lib/toast';

const orderChip = (o: DriverOrder) =>
  o.status === 'DELIVERED'
    ? { label: 'سُلّم', tone: 'ok' as const }
    : o.status === 'DELIVERY_FAILED'
      ? { label: 'تعذّر التسليم', tone: 'bad' as const }
      : o.allPickedUp
        ? { label: 'في الطريق للزبون', tone: 'primary' as const }
        : { label: 'بانتظار الاستلام', tone: 'warn' as const };

function WorkStatusCard() {
  useTheme();
  const { data: me } = useDriverProfile();
  const { workStatus } = useDriverActions();
  const current = displayWorkStatus(me?.workStatus);

  const change = (value: WorkStatus) => {
    if (value === current || workStatus.isPending) return;
    workStatus.mutate(value, { onError: (e) => toast.error((e as { message?: string }).message || 'تعذّر تغيير الحالة') });
  };

  return (
    <>
      <View style={styles.hero}>
        <View style={styles.row}>
          <View>
            <AppText style={styles.heroMuted}>مرحباً</AppText>
            <AppText weight="extraBold" style={{ color: colors.white, fontSize: 20 }}>{me?.fullName ?? '...'}</AppText>
          </View>
          <Chip label={current === 'offline' ? 'غير متصل' : 'متصل'} tone={current === 'offline' ? 'muted' : 'ok'} />
        </View>
        <View style={styles.seg}>
          {WORK_STATUSES.map((s) => (
            <Pressable key={s.value} onPress={() => change(s.value)} style={[styles.segItem, current === s.value && styles.segOn]} accessibilityRole="button">
              <AppText weight="bold" style={{ fontSize: 13, color: current === s.value ? '#06281E' : colors.white }}>{s.label}</AppText>
            </Pressable>
          ))}
        </View>
        <AppText style={styles.heroMuted}>
          {canReceiveOrders(me?.workStatus) ? 'الموقع مشارَك أثناء الدوام فقط' : 'غيّر حالتك إلى «متاح» لتستقبل الطلبات'}
        </AppText>
      </View>
      <View style={styles.row}>
        <View style={[styles.tile, { flex: 1 }]}>
          <AppText muted style={{ fontSize: 12 }}>اليوم</AppText>
          <AppText weight="extraBold" style={{ fontSize: 24 }}>{me?.deliveredToday ?? 0}</AppText>
          <AppText muted style={{ fontSize: 12 }}>طلبات</AppText>
        </View>
        <View style={[styles.tile, { flex: 1 }]}>
          <AppText muted style={{ fontSize: 12 }}>نقد بحوزتك</AppText>
          <AppText weight="extraBold" style={{ fontSize: 24 }}>{Math.round(me?.cashInHand ?? 0).toLocaleString('en-US')}</AppText>
          <AppText muted style={{ fontSize: 12 }}>د.ع</AppText>
        </View>
      </View>
    </>
  );
}

export default function OrdersScreen() {
  useTheme();
  const orders = useDriverOrders(false);
  const refreshAll = useRefreshDriver();
  const list = newestFirst(orders.data ?? [], (o) => o.assignedAt);

  return (
    <Screen title="الطلبات" refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={refreshAll} />}>
      <WorkStatusCard />
      <AppText weight="bold" style={{ fontSize: 15 }}>طلبات مسندة إليك</AppText>
      {list.length === 0 && !orders.isLoading && <Empty icon="cube-outline" text="ستظهر هنا الطلبات فور إسنادها إليك" />}
      {list.map((o) => {
        const chip = orderChip(o);
        return (
          <Pressable key={o.orderId} onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.orderId } })}>
            <Card tone={chip.tone === 'warn' ? 'warn' : undefined}>
              <View style={styles.row}>
                <AppText weight="bold" style={{ writingDirection: 'ltr' }}>{o.orderNumber}</AppText>
                <Chip label={chip.label} tone={chip.tone} />
              </View>
              <AppText weight="medium">{o.customerName}</AppText>
              <AppText muted style={{ fontSize: 13 }} numberOfLines={2}>{[o.zoneName, o.address].filter(Boolean).join('، ')}</AppText>
              <View style={styles.row}>
                <AppText muted style={{ fontSize: 13 }}>{o.stores.length} {o.stores.length === 1 ? 'متجر' : 'متاجر'} · {formatClock(o.assignedAt)}</AppText>
                <AppText weight="bold">{o.amountToCollect > 0 ? money(o.amountToCollect) : 'مدفوع'}</AppText>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = createStyles(() => ({
  hero: { backgroundColor: '#1F2937', borderRadius: radius.xl, padding: 14, gap: 12 },
  heroMuted: { color: '#C7CCD6', fontSize: 12.5 },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg, padding: 3, gap: 3 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md },
  segOn: { backgroundColor: colors.success },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tile: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 2 },
}));
