import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { formatDateTime, newestFirst, splitReturnTrips, type ReturnTrip } from '@wasit/shared';
import { AppText, brand, colors, createStyles, useTheme } from '@wasit/ui';
import { useDriverActions, useDriverReturns, useRefreshDriver } from '../../api/useDriver';
import { ActionButton, Card, Chip, ChipFilter, Empty, openNavigation, PhoneRow, Screen } from '../../components/kit';
import { confirmDialog } from '../../lib/dialog';
import { toast } from '../../lib/toast';

// النقر على بطاقة المرتجع يفتح تفاصيله (المعرّف: رقم المرتجع، أو رقم الرحلة لرفض الباب وتعذّر التسليم)
const OpenReturn = ({ trip, children }: { trip: ReturnTrip; children: React.ReactNode }) => (
  <Pressable onPress={() => router.push({ pathname: '/return/[id]', params: { id: trip.returnId ?? trip.id } })} style={({ pressed }) => pressed && { opacity: 0.85 }}>
    {children}
  </Pressable>
);

const Items = ({ trips }: { trips: ReturnTrip[] }) => (
  <View style={styles.items}>
    {trips.flatMap((t) => t.items).map((i, k) => (
      <View key={k} style={styles.item}>
        <AppText style={{ fontSize: 12 }}>{i.productName} ×{i.quantity}</AppText>
      </View>
    ))}
  </View>
);

// أخذ القطع من الزبون: مرتجع واحد قد يخص أكثر من متجر
function CustomerPickup({ trips }: { trips: ReturnTrip[] }) {
  const first = trips[0];
  const { collectReturn, failReturn } = useDriverActions();
  const busy = collectReturn.isPending || failReturn.isPending;
  const returnId = first.returnId ?? first.id;
  const vendors = [...new Set(trips.map((t) => t.vendorName))].join('، ');

  return (
    <OpenReturn trip={first}>
    <Card tone="warn" accent={colors.warning}>
      <View style={styles.row}>
        <AppText weight="bold">خذ القطع من الزبون</AppText>
        <Chip label={first.returnNumber ?? 'مرتجع'} tone="warn" />
      </View>
      <AppText weight="medium">{first.customerName}</AppText>
      <PhoneRow phone={first.customerPhone} />
      {!!first.customerAddress && (
        <AppText style={{ fontSize: 13 }} onPress={() => openNavigation({ latitude: first.latitude, longitude: first.longitude, address: first.customerAddress })}>
          📍 {first.customerAddress}
        </AppText>
      )}
      <Items trips={trips} />
      <AppText muted style={{ fontSize: 12 }}>ثم أوصلها إلى: {vendors}</AppText>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <ActionButton
            title="تعذّر الاستلام"
            tone="ghost"
            disabled={busy}
            onPress={() =>
              confirmDialog({
                title: 'تعذّر أخذ القطع؟',
                message: 'ستُبلَّغ العمليات.',
                confirmText: 'تأكيد',
                tone: 'danger',
                onConfirm: async () => {
                  try {
                    await failReturn.mutateAsync({ returnId });
                    toast.info('أُبلغت العمليات');
                  } catch (e) {
                    toast.error((e as { message?: string }).message || 'تعذّر الإرسال');
                  }
                },
              })
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton
            title="أخذت القطع"
            icon="checkmark"
            loading={collectReturn.isPending}
            disabled={busy}
            onPress={() =>
              collectReturn.mutate(returnId, {
                onSuccess: () => toast.success('سجّلنا أخذ القطع — أوصلها للمتجر'),
                onError: (e) => toast.error((e as { message?: string }).message || 'تعذّر التسجيل'),
              })
            }
          />
        </View>
      </View>
    </Card>
    </OpenReturn>
  );
}

// قطع معه: يسلّمها للمتجر والمتجر يؤكد الاستلام
function VendorDelivery({ trip }: { trip: ReturnTrip }) {
  return (
    <OpenReturn trip={trip}>
    <Card accent={colors.primary}>
      <AppText weight="bold">{trip.vendorName}</AppText>
      <PhoneRow phone={trip.vendorPhone} />
      {!!trip.vendorAddress && <AppText muted style={{ fontSize: 13 }}>{trip.vendorAddress}</AppText>}
      <AppText muted style={{ fontSize: 12 }}>{trip.reasonAr} · {trip.subOrderNumber}</AppText>
      <Items trips={[trip]} />
      <Chip label="بانتظار تأكيد المتجر" tone="muted" />
    </Card>
    </OpenReturn>
  );
}

// مرتجع أنهاه المتجر: يبقى في السجل 7 أيام
function ClosedTrip({ trip }: { trip: ReturnTrip }) {
  return (
    <OpenReturn trip={trip}>
    <Card accent={colors.success}>
      <View style={styles.row}>
        <AppText weight="bold">{trip.vendorName}</AppText>
        <Chip label="استلمها المتجر" tone="ok" />
      </View>
      <AppText muted style={{ fontSize: 12 }}>{trip.returnNumber ?? trip.subOrderNumber} · {trip.reasonAr}</AppText>
      <Items trips={[trip]} />
      {!!trip.receivedAt && <AppText muted style={{ fontSize: 12 }}>{formatDateTime(trip.receivedAt)}</AppText>}
    </Card>
    </OpenReturn>
  );
}

export default function ReturnsScreen() {
  useTheme();
  const returns = useDriverReturns();
  const closed = useDriverReturns(true);
  const refreshAll = useRefreshDriver();
  const [tab, setTab] = useState<'open' | 'history'>('open');
  const split = splitReturnTrips(newestFirst(returns.data ?? [], (t) => t.createdAt));
  const history = newestFirst(closed.data ?? [], (t) => t.receivedAt ?? t.createdAt);
  const openCount = split.pickups.length + split.deliveries.length;
  const showHistory = tab === 'history';
  const shown = showHistory ? history.length : openCount;

  return (
    <Screen title="المرتجعات" refreshControl={<RefreshControl refreshing={returns.isRefetching} onRefresh={refreshAll} />}>
      <ChipFilter options={[{ value: 'open', label: `الحالية · ${openCount}` }, { value: 'history', label: 'السجل' }] as const} value={tab} onChange={setTab} />
      {shown === 0 && !returns.isLoading && (
        <Empty icon="return-down-back-outline" text={showHistory ? 'لا توجد مرتجعات منتهية' : 'لا توجد مرتجعات بعهدتك'} />
      )}
      {!showHistory && split.pickups.map((group) => <CustomerPickup key={group[0].returnId ?? group[0].id} trips={group} />)}
      {!showHistory && split.deliveries.map((t) => <VendorDelivery key={t.id} trip={t} />)}
      {showHistory && history.map((t) => <ClosedTrip key={t.id} trip={t} />)}
    </Screen>
  );
}

const styles = createStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  item: { backgroundColor: brand.surfaceMuted, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
}));
