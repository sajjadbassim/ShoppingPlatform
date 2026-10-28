import { useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatClock, getImageUrl, IMG_SIZE, mapsUrl, pendingPickups, type ApiError, type DriverOrder, type DriverItem } from '@wasit/shared';
import { AppText, brand, colors, createStyles, useTheme } from '@wasit/ui';
import { useDriverActions, useDriverOrders, useRefreshDriver } from '../../api/useDriver';
import { DeliverSheet } from '../../components/DeliverSheet';
import { FailSheet } from '../../components/FailSheet';
import { ActionButton, callPhone, Card, Chip, Empty, money, PhoneRow } from '../../components/kit';
import { toast } from '../../lib/toast';

// منتج داخل محطة المتجر: ما يستلمه المندوب من المتجر ويسلّمه للزبون
function ItemRow({ item }: { item: DriverItem }) {
  useTheme();
  const uri = getImageUrl(item.imageUrl, IMG_SIZE.THUMB);
  return (
    <View style={styles.item}>
      {uri ? <Image source={{ uri }} style={styles.thumb} /> : <View style={[styles.thumb, { alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="image-outline" size={20} color={colors.placeholder} /></View>}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText weight="medium" numberOfLines={2}>{item.name}</AppText>
        {!!item.variant && <AppText muted style={{ fontSize: 12 }}>{item.variant}</AppText>}
        {item.refusedQuantity > 0 && <AppText style={{ fontSize: 12, color: colors.errorDark }}>مرفوض منه {item.refusedQuantity}</AppText>}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <AppText weight="bold">{'‎'}×{item.quantity}</AppText>
        <AppText muted style={{ fontSize: 12 }}>{money(item.unitPrice * item.quantity)}</AppText>
      </View>
    </View>
  );
}

const errorMessage = (e: unknown, fallback: string) => (e as ApiError)?.message || fallback;

export default function OrderScreen() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orders = useDriverOrders(false);
  // الطلبات المسلَّمة أو التي تعذّر تسليمها (آخر 7 أيام) تُفتح من النقد وغيره
  const history = useDriverOrders(true);
  const refreshAll = useRefreshDriver();
  const { pickUp, deliver, fail } = useDriverActions();
  const [delivering, setDelivering] = useState<DriverOrder | null>(null);
  const [failing, setFailing] = useState<{ order: DriverOrder; reason?: string } | null>(null);
  // «التوصيل الجاري»: بعد الاستلام من كل المتاجر يضغط المندوب «ابدأ التوصيل» فتظهر لوحة الطريق للزبون
  const [onTheWay, setOnTheWay] = useState(false);

  const order = orders.data?.find((o) => o.orderId === id) ?? history.data?.find((o) => o.orderId === id);
  const finished = order && (order.status === 'DELIVERED' || order.status === 'DELIVERY_FAILED');
  const pending = order ? pendingPickups(order) : [];
  // قيمة المنتجات قبل الخصومات (القطع المرفوضة تبقى ظاهرة بعلامتها)
  const productsTotal = order ? order.stores.reduce((sum, st) => sum + st.items.reduce((a, i) => a + i.unitPrice * i.quantity, 0), 0) : 0;

  const doPickUp = (subOrderId: string) =>
    pickUp.mutate(subOrderId, {
      onSuccess: () => toast.success('سجّلنا الاستلام من المتجر'),
      onError: (e) => toast.error(errorMessage(e, 'تعذّر تسجيل الاستلام')),
    });

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="رجوع">
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
        </Pressable>
        <AppText weight="extraBold" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 18, flex: 1, writingDirection: 'ltr', textAlign: 'right' }}>{order?.orderNumber ?? 'الطلب'}</AppText>
        {order?.status === 'DELIVERED' && <Chip label={`سُلّم ${formatClock(order.deliveredAt)}`} tone="ok" />}
        {order?.status === 'DELIVERY_FAILED' && <Chip label="تعذّر التسليم" tone="bad" />}
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={refreshAll} />}>
        {!order ? (
          <Empty icon="alert-circle-outline" text={orders.isLoading || history.isLoading ? 'جاري التحميل...' : 'لا تتوفر تفاصيل هذا الطلب. تُحفظ تفاصيل الطلبات المنتهية 7 أيام فقط'} />
        ) : (
          <>
            <Card>
              <View style={styles.row}>
                <AppText weight="bold">المحطات</AppText>
                <Chip label={pending.length > 0 ? `باقٍ ${pending.length} استلام` : 'استُلم كل شيء'} tone={pending.length > 0 ? 'warn' : 'ok'} />
              </View>
              {order.stores.map((s, n) => (
                <View key={s.subOrderId} style={styles.stop}>
                  <View style={[styles.dot, !!s.pickedUpAt && { backgroundColor: colors.success }]}>
                    <AppText weight="bold" style={{ fontSize: 12, color: s.pickedUpAt ? '#06281E' : colors.primary }}>{s.pickedUpAt ? '✓' : n + 1}</AppText>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText weight="bold">{s.vendorName}</AppText>
                    {!!s.vendorAddress && <AppText muted style={{ fontSize: 12.5 }}>{s.vendorAddress}</AppText>}
                    <AppText muted style={{ fontSize: 12 }}>{s.itemsCount} قطعة{s.pickedUpAt ? ` · استُلم ${formatClock(s.pickedUpAt)}` : ''}</AppText>
                    <PhoneRow phone={s.vendorPhone} />
                    {s.items.map((i) => <ItemRow key={i.subOrderItemId} item={i} />)}
                    {!s.pickedUpAt && !finished && (
                      <ActionButton title="تم الاستلام من المتجر" icon="bag-check-outline" loading={pickUp.isPending && pickUp.variables === s.subOrderId} disabled={pickUp.isPending} onPress={() => doPickUp(s.subOrderId)} />
                    )}
                  </View>
                </View>
              ))}
            </Card>

            <Card>
              <AppText weight="bold">الزبون</AppText>
              <AppText weight="medium">{order.customerName}</AppText>
              <AppText style={{ fontSize: 14, lineHeight: 22 }}>{[order.zoneName, order.address, order.addressDetails].filter(Boolean).join('، ')}</AppText>
              {!!order.addressNotes && <AppText muted style={{ fontSize: 13 }}>ملاحظة العنوان: {order.addressNotes}</AppText>}
              {!!order.customerNotes && <AppText muted style={{ fontSize: 13 }}>ملاحظة الزبون: {order.customerNotes}</AppText>}
              {!!order.deliverySlotStart && (
                <AppText muted style={{ fontSize: 13 }}>الموعد: {formatClock(order.deliverySlotStart)} – {formatClock(order.deliverySlotEnd)}</AppText>
              )}
              {!!order.customerPhone && (
                <View style={styles.row}>
                  <View style={{ flex: 1 }}><ActionButton title="اتصال" icon="call-outline" tone="ghost" onPress={() => callPhone(order.customerPhone)} /></View>
                  <View style={{ flex: 1 }}><ActionButton title="رسالة" icon="chatbubble-outline" tone="ghost" onPress={() => Linking.openURL(`sms:${order.customerPhone}`)} /></View>
                </View>
              )}
              <ActionButton title="ملاحة" icon="navigate-outline" tone="ghost" onPress={() => Linking.openURL(mapsUrl(order))} />
            </Card>

            <Card>
              <AppText weight="bold">الدفع</AppText>
              <View style={styles.row}>
                <AppText muted>قيمة المنتجات</AppText>
                <AppText>{money(productsTotal)}</AppText>
              </View>
              <View style={styles.row}>
                <AppText muted>أجرة التوصيل</AppText>
                <AppText>{order.deliveryFee > 0 ? money(order.deliveryFee) : 'مجاني'}</AppText>
              </View>
              <View style={[styles.row, styles.total]}>
                <AppText weight="bold" style={{ flexShrink: 1 }}>{finished && order.amountToCollect <= 0 ? 'التحصيل' : 'المطلوب تحصيله'}</AppText>
                <AppText weight="extraBold" style={{ fontSize: order.amountToCollect > 0 ? 18 : 15 }}>{order.amountToCollect > 0 ? money(order.amountToCollect) : 'مدفوع مسبقاً'}</AppText>
              </View>
              <Chip label={order.amountToCollect > 0 ? 'دفع عند الاستلام' : 'مدفوع'} tone={order.amountToCollect > 0 ? 'primary' : 'ok'} />
            </Card>

            {!finished && pending.length > 0 && (
              <View style={{ gap: 10 }}>
                <ActionButton title="استلم من المتاجر أولاً" icon="bag-check-outline" disabled onPress={() => {}} />
                <ActionButton title="تعذّر التسليم" icon="close-circle-outline" tone="bad" onPress={() => setFailing({ order })} />
              </View>
            )}
            {!finished && pending.length === 0 && !onTheWay && (
              <View style={{ gap: 10 }}>
                <ActionButton title="ابدأ التوصيل" icon="arrow-back" onPress={() => setOnTheWay(true)} />
                <ActionButton title="تعذّر التسليم" icon="close-circle-outline" tone="bad" onPress={() => setFailing({ order })} />
              </View>
            )}
            {!finished && pending.length === 0 && onTheWay && (
              <Card tone="ok">
                <View style={styles.row}>
                  <AppText weight="extraBold" style={{ fontSize: 16 }}>في الطريق للزبون</AppText>
                  <Chip label="جاري التوصيل" tone="ok" />
                </View>
                <AppText weight="medium">{order.customerName}</AppText>
                <AppText muted style={{ fontSize: 13, lineHeight: 22 }}>{[order.zoneName, order.address].filter(Boolean).join('، ')}</AppText>
                <ActionButton title="فتح الملاحة" icon="navigate" onPress={() => Linking.openURL(mapsUrl(order))} />
                <ActionButton title="وصلت: تسليم الطلب" icon="checkmark-circle-outline" tone="ok" onPress={() => setDelivering(order)} />
                <ActionButton title="تعذّر التسليم" icon="close-circle-outline" tone="bad" onPress={() => setFailing({ order })} />
              </Card>
            )}
          </>
        )}
      </ScrollView>

      <DeliverSheet
        order={delivering}
        loading={deliver.isPending}
        onClose={() => setDelivering(null)}
        onFullRefusal={(o) => {
          setDelivering(null);
          setFailing({ order: o, reason: 'customer_refused' });
        }}
        onConfirm={(payload) =>
          delivering &&
          deliver.mutate(
            { orderId: delivering.orderId, payload },
            {
              onSuccess: () => {
                toast.success('تم تسجيل التسليم');
                setDelivering(null);
                router.back();
              },
              onError: (e) => toast.error(errorMessage(e, 'تعذّر تسجيل التسليم')),
            },
          )
        }
      />
      <FailSheet
        order={failing?.order ?? null}
        initialReason={failing?.reason}
        loading={fail.isPending}
        onClose={() => setFailing(null)}
        onConfirm={(payload) =>
          failing &&
          fail.mutate(
            { orderId: failing.order.orderId, payload },
            {
              onSuccess: () => {
                toast.info('سُجّل تعذّر التسليم وأُبلغت العمليات');
                setFailing(null);
                router.back();
              },
              onError: (e) => toast.error(errorMessage(e, 'تعذّر تسجيل الحالة')),
            },
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  content: { padding: 16, paddingTop: 4, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingTop: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: brand.surfaceMuted },
  total: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
}));
