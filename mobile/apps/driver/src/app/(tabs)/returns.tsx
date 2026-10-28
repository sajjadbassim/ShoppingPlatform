import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { newestFirst, splitReturnTrips, type ReturnTrip } from '@wasit/shared';
import { AppText, brand, colors, createStyles, useTheme } from '@wasit/ui';
import { useDriverActions, useDriverReturns, useRefreshDriver } from '../../api/useDriver';
import { ActionButton, Card, Chip, ChipFilter, Empty, openNavigation, PhoneRow, Screen } from '../../components/kit';
import { inPeriod, PERIODS, type Period } from '../../lib/period';
import { confirmDialog } from '../../lib/dialog';
import { toast } from '../../lib/toast';

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
  );
}

// قطع معه: يسلّمها للمتجر والمتجر يؤكد الاستلام
function VendorDelivery({ trip }: { trip: ReturnTrip }) {
  return (
    <Card accent={colors.primary}>
      <AppText weight="bold">{trip.vendorName}</AppText>
      <PhoneRow phone={trip.vendorPhone} />
      {!!trip.vendorAddress && <AppText muted style={{ fontSize: 13 }}>{trip.vendorAddress}</AppText>}
      <AppText muted style={{ fontSize: 12 }}>{trip.reasonAr} · {trip.subOrderNumber}</AppText>
      <Items trips={[trip]} />
      <Chip label="بانتظار تأكيد المتجر" tone="muted" />
    </Card>
  );
}

export default function ReturnsScreen() {
  useTheme();
  const returns = useDriverReturns();
  const refreshAll = useRefreshDriver();
  const [kind, setKind] = useState<'pickup' | 'vendor' | 'all'>('all');
  const [period, setPeriod] = useState<Period>('all');
  const split = splitReturnTrips(newestFirst(returns.data ?? [], (t) => t.createdAt));
  const total = split.pickups.length + split.deliveries.length;
  const pickups = kind === 'vendor' ? [] : split.pickups.filter((g) => inPeriod(g[0].createdAt, period));
  const deliveries = kind === 'pickup' ? [] : split.deliveries.filter((t) => inPeriod(t.createdAt, period));
  const shown = pickups.length + deliveries.length;

  return (
    <Screen title="المرتجعات" refreshControl={<RefreshControl refreshing={returns.isRefetching} onRefresh={refreshAll} />}>
      <AppText muted style={{ fontSize: 13, lineHeight: 22 }}>
        خذ القطع من الزبون ثم أرجعها لمتاجرها حين تتفرغ. المتجر يؤكد الاستلام.
      </AppText>
      <ChipFilter options={PERIODS} value={period} onChange={setPeriod} />
      <ChipFilter
        options={[{ value: 'pickup', label: `من الزبون · ${split.pickups.length}` }, { value: 'vendor', label: `للمتاجر · ${split.deliveries.length}` }, { value: 'all', label: 'الكل' }] as const}
        value={kind}
        onChange={setKind}
      />
      {shown === 0 && !returns.isLoading && (
        <Empty icon={total === 0 ? 'return-down-back-outline' : 'funnel-outline'} text={total === 0 ? 'لا توجد مرتجعات بعهدتك' : 'لا مرتجعات تطابق هذا الفلتر'} />
      )}
      {pickups.map((group) => <CustomerPickup key={group[0].returnId ?? group[0].id} trips={group} />)}
      {deliveries.map((t) => <VendorDelivery key={t.id} trip={t} />)}
    </Screen>
  );
}

const styles = createStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  item: { backgroundColor: brand.surfaceMuted, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
}));
