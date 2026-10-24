import { useEffect, useMemo, useState } from 'react';
import { Linking, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ORDER_STATUS_LABELS, type VendorOrder, type VendorReturnTrip } from '@wasit/shared';
import { AppText, colors, createStyles, fonts, useTheme } from '@wasit/ui';
import { useOrderActions, useOrderCounts, useOrders, useRefreshOrders, useReturnTrips } from '../../api/useVendor';
import { ActionButton, Card, Chip, Empty, FilterPills, ltr, Screen, Segmented } from '../../components/kit';
import { OrderCard } from '../../components/OrderCard';
import { RejectSheet } from '../../components/RejectSheet';
import { confirmDialog } from '../../lib/dialog';
import { toast } from '../../lib/toast';

const STATUS_ORDER = ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED'];

type Tab = 'orders' | 'returns';

export default function OrdersScreen() {
  useTheme();
  const params = useLocalSearchParams<{ tab?: string; status?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'returns' ? 'returns' : 'orders');
  const [status, setStatus] = useState<string>(params.status ?? 'PENDING_CONFIRMATION');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [rejecting, setRejecting] = useState<VendorOrder | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // بحث مباشر بعد توقف الكتابة (دون انتظار زر البحث)
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const counts = useOrderCounts();
  const list = useOrders(status, term);
  const trips = useReturnTrips();
  const actions = useOrderActions();
  const refresh = useRefreshOrders();

  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const byStatus = counts.data?.byStatus ?? {};
  const pendingCount = byStatus.PENDING_CONFIRMATION ?? 0;

  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّر تنفيذ العملية');
    } finally {
      setBusyId(null);
    }
  };

  const accept = (o: VendorOrder) =>
    confirmDialog({
      title: 'قبول الطلب؟',
      message: `الطلب ${o.subOrderNumber}. للقبول الجزئي (بعض القطع غير متوفرة) افتح الطلب.`,
      confirmText: 'قبول',
      onConfirm: () => run(o.subOrderId, () => actions.confirm.mutateAsync({ id: o.subOrderId }), 'تم قبول الطلب'),
    });

  const advance = (o: VendorOrder, step: 'preparing' | 'ready') =>
    run(o.subOrderId, () => (step === 'preparing' ? actions.preparing.mutateAsync(o.subOrderId) : actions.ready.mutateAsync(o.subOrderId)), step === 'preparing' ? 'بدأ تحضير الطلب' : 'الطلب جاهز، أُبلغ فريق التوصيل');

  return (
    <Screen title="الطلبات" tabs refreshing={list.isRefetching} onRefresh={() => { refresh(); }}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: 'orders', label: 'الطلبات', badge: pendingCount },
          { key: 'returns', label: 'المرتجعات', badge: (trips.data ?? []).length },
        ]}
      />

      {tab === 'orders' ? (
        <>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.placeholder} />
            <TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => setTerm(search.trim())} onBlur={() => setTerm(search.trim())} returnKeyType="search" placeholder="رقم الطلب أو اسم الزبون" placeholderTextColor={colors.placeholder} style={styles.searchInput} textAlign="right" />
          </View>
          <FilterPills
            value={status}
            onChange={setStatus}
            options={[
              { key: 'all', label: 'الكل', count: counts.data?.total },
              ...STATUS_ORDER.map((s) => ({ key: s, label: s === 'PENDING_CONFIRMATION' ? 'بانتظار قرارك' : ORDER_STATUS_LABELS[s], count: byStatus[s] ?? 0, alert: s === 'PENDING_CONFIRMATION' && (byStatus[s] ?? 0) > 0 })),
            ]}
          />
          {status !== 'PENDING_CONFIRMATION' && pendingCount > 0 && (
            <Card tone="warn" onPress={() => setStatus('PENDING_CONFIRMATION')}>
              <AppText weight="bold" style={{ fontSize: 14 }}>{pendingCount} طلب ينتظر قرارك، اضغط لعرضها</AppText>
            </Card>
          )}
          {list.isLoading ? (
            <AppText muted style={{ textAlign: 'center', paddingVertical: 30 }}>جاري التحميل...</AppText>
          ) : items.length === 0 ? (
            <Empty icon="receipt-outline" text={term ? 'لا توجد نتائج للبحث' : status === 'PENDING_CONFIRMATION' ? 'لا توجد طلبات تنتظر قرارك' : 'لا توجد طلبات هنا'} />
          ) : (
            items.map((o) => <OrderCard key={o.subOrderId} order={o} busy={busyId === o.subOrderId} onAccept={() => accept(o)} onReject={() => setRejecting(o)} onAdvance={(s) => advance(o, s)} />)
          )}
          {list.hasNextPage && <ActionButton title={list.isFetchingNextPage ? 'جاري التحميل...' : 'عرض المزيد'} tone="ghost" onPress={() => list.fetchNextPage()} />}
        </>
      ) : (
        <ReturnTrips trips={trips.data ?? []} loading={trips.isLoading} onReceive={(t) => run(t.id, () => actions.received.mutateAsync(t.id), 'تم تأكيد الاستلام وأُعيدت القطع للمخزون')} busyId={busyId} />
      )}

      <RejectSheet
        order={rejecting}
        busy={!!rejecting && busyId === rejecting.subOrderId}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => {
          const o = rejecting;
          if (!o) return;
          run(o.subOrderId, () => actions.reject.mutateAsync({ id: o.subOrderId, reason }), 'تم رفض الطلب').then(() => setRejecting(null));
        }}
      />
    </Screen>
  );
}

// بضاعة لم تُسلَّم للزبون أو أرجعها بعد الاستلام: تعود مع السائق والمتجر يؤكد الاستلام فتعود للمخزون
function ReturnTrips({ trips, loading, onReceive, busyId }: { trips: VendorReturnTrip[]; loading: boolean; onReceive: (t: VendorReturnTrip) => void; busyId: string | null }) {
  useTheme();
  if (loading) return <AppText muted style={{ textAlign: 'center', paddingVertical: 30 }}>جاري التحميل...</AppText>;
  if (trips.length === 0) return <Empty icon="return-down-back-outline" text="لا توجد بضاعة عائدة إليك" />;
  return (
    <>
      <AppText muted style={{ fontSize: 13, lineHeight: 22 }}>لم تُسلَّم للزبون، أو أرجعها الزبون بعد الاستلام. تعود مع السائق، وحين تستلمها تعود القطع للمخزون (أي نقص يعوّضه المتجر).</AppText>
      {trips.map((t) => {
        const atCustomer = t.status === 'AT_CUSTOMER';
        return (
          <Card key={t.id} tone={atCustomer ? undefined : 'ok'}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText weight="extraBold" style={{ flex: 1, fontSize: 15, writingDirection: 'ltr', textAlign: 'right' }}>{t.subOrderNumber}</AppText>
              <Chip label={atCustomer ? 'السائق يأخذها من الزبون' : 'وصلت إليك'} tone={atCustomer ? 'primary' : 'ok'} />
            </View>
            <AppText muted style={{ fontSize: 13 }}>السبب: {t.reasonAr}</AppText>
            {!!t.driverName && (
              <AppText style={{ fontSize: 13.5 }}>
                السائق: {t.driverName}
                {!!t.driverPhone && (
                  <AppText onPress={() => Linking.openURL(`tel:${t.driverPhone}`)} style={{ color: colors.primaryHover, fontSize: 13.5 }}> · {ltr(t.driverPhone)}</AppText>
                )}
              </AppText>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {t.items.map((i, k) => (
                <View key={k} style={styles.itemChip}><AppText style={{ fontSize: 12.5 }}>{i.productName} {ltr(`×${i.quantity}`)}</AppText></View>
              ))}
            </View>
            {!atCustomer && (
              <View style={{ flexDirection: 'row' }}>
                <ActionButton title="استلمتها" icon="checkmark" onPress={() => confirmDialog({ title: 'استلمت هذه البضاعة من السائق؟', message: 'ستعود القطع للمخزون.', confirmText: 'تأكيد الاستلام', onConfirm: () => onReceive(t) })} loading={busyId === t.id} compact />
              </View>
            )}
          </Card>
        );
      })}
    </>
  );
}

const styles = createStyles(() => ({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text, paddingVertical: 8 },
  itemChip: { backgroundColor: '#F8ECDA', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
}));
