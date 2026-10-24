import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { canCancelOrder, fetchOrderTiming, fmtMinutes, reorderLines, formatPrice, formatQuantity, getImageUrl, IMG_SIZE, type ApiError, type OrderItem, formatDateTime } from '@wasit/shared';
import { AppText, Button, brand, colors, createStyles, createThemed, fonts, radius, spacing, tc, useTheme } from '@wasit/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCancelOrder, useOrder, useOrderTracking } from '../../api/useOrders';
import { AppHeader } from '../../components/AppHeader';
import { openInvoice } from '../../lib/invoice';
import { OrderRatingForm } from '../../components/OrderRatingForm';
import { SoftPing } from '../../components/Motion';
import { StatusBadge } from '../../components/StatusBadge';
import { toast, toastReorderResult } from '../../lib/toast';


const call = (phone: string) => Linking.openURL(`tel:${phone}`).catch(() => toast.error('تعذّر فتح الاتصال'));

export default function OrderScreen() {
  useTheme();
  const { id, success, track } = useLocalSearchParams<{ id: string; success?: string; track?: string }>();
  // شاشة التأكيد تظهر مرة واحدة بعد إتمام الشراء، ثم تُزال من الرابط فلا تعود عند فتح الطلب لاحقاً
  const [showSuccess] = useState(() => success === '1');
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    if (success) router.setParams({ success: '' });
  }, [success]);
  const [trackingY, setTrackingY] = useState(0);
  // «تتبع الطلب» من قائمة الطلبات ينزل مباشرة إلى قسم التتبع
  const scrolledToTracking = useRef(false);
  useEffect(() => {
    if (track && trackingY > 0 && !scrolledToTracking.current) {
      scrolledToTracking.current = true;
      scrollRef.current?.scrollTo({ y: Math.max(0, trackingY - 12), animated: true });
    }
  }, [track, trackingY]);
  const { data: order, isLoading, isError, refetch } = useOrder(id);
  const { data: tracking, refetch: refetchTracking } = useOrderTracking(id);
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else {
        refetch();
        refetchTracking();
      }
    }, [refetch, refetchTracking]),
  );
  const cancel = useCancelOrder(id);
  const queryClient = useQueryClient();
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [reordering, setReordering] = useState(false);
  const delivered = !!order?.subOrders.some((s) => s.status === 'DELIVERED');
  const { data: timing } = useQuery({
    queryKey: ['order-timing', id],
    queryFn: () => fetchOrderTiming(id),
    enabled: delivered,
  });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView style={styles.center}>
        <AppText weight="bold">تعذّر تحميل الطلب</AppText>
        <Button title="إعادة المحاولة" onPress={() => refetch()} style={{ marginTop: spacing.md }} />
        <Button title="رجوع" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.sm }} />
      </SafeAreaView>
    );
  }

  const confirmCancel = () => {
    if (!reason.trim()) {
      setReasonError('اكتب سبب الإلغاء');
      return;
    }
    cancel.mutate(reason, {
      onSuccess: () => {
        setCancelOpen(false);
        setReason('');
      },
      onError: (e) => setReasonError((e as ApiError).message || 'تعذّر إلغاء الطلب'),
    });
  };

  // طلب من أكثر من متجر قد يوصّله سائق واحد: نعرضه مرة واحدة
  const drivers = [
    ...new Map(
      (tracking?.subOrders ?? []).filter((s) => s.driver).map((s) => [`${s.driver!.driverName}|${s.driver!.driverPhone}`, s]),
    ).values(),
  ];

  const viewInvoice = async () => {
    setInvoiceBusy(true);
    await openInvoice(order!.id, order!.orderNumber);
    setInvoiceBusy(false);
  };

  const reorder = async () => {
    setReordering(true);
    const lines = order.subOrders.flatMap((sub) =>
      sub.items
        .filter((i) => i.quantity - i.unavailableQuantity > 0)
        .map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity - i.unavailableQuantity - i.refusedQuantity,
          name: i.productNameAr || i.productName,
        }))
        .filter((l) => l.quantity > 0),
    );
    const result = await reorderLines(lines);
    await queryClient.invalidateQueries({ queryKey: ['cart'] });
    setReordering(false);
    toastReorderResult(result.added, lines.length, result.failed);
  };

  const items = order.subOrders.flatMap((sub) => sub.items.map((item) => ({ item, delivered: sub.status === 'DELIVERED' })));
  const hideTracking = order.status === 'CANCELLED' || order.status === 'DELIVERY_FAILED';
  const dateText = formatDateTime(order.createdAt);
  const refusalOnly = order.discountAmount > 0 && !(order.couponDiscountAmount > 0 || order.pointsDiscountAmount > 0);

  return (
    <View style={styles.safe}>
      <AppHeader back />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {showSuccess && (
          <View style={styles.successCard}>
            <View style={styles.successTop}>
              <View style={styles.successArt}>
                <SoftPing style={styles.successPing} />
                <View style={styles.successCircle}>
                  <Ionicons name="checkmark-circle-outline" size={46} color={colors.white} />
                </View>
              </View>
              <AppText weight="bold" style={styles.successTitle}>
                تم استلام طلبك بنجاح! 🎉
              </AppText>
              <AppText muted style={styles.successText}>
                شكراً لتسوقك من واسط. سنتواصل معك قريباً لتأكيد الطلب.
              </AppText>
              <View style={styles.tiles}>
                <View style={styles.tile}>
                  <AppText muted style={styles.tileLabel}>
                    رقم الطلب
                  </AppText>
                  <AppText weight="bold" style={styles.tileValue}>
                    #{order.orderNumber}
                  </AppText>
                </View>
                <View style={styles.tile}>
                  <AppText muted style={styles.tileLabel}>
                    المبلغ عند الاستلام
                  </AppText>
                  <AppText weight="bold" style={[styles.tileValue, { color: colors.primary }]}>
                    {formatPrice(order.totalAmount)}
                  </AppText>
                </View>
              </View>
              <AppText muted style={styles.successNote}>
                💵 الدفع نقداً عند الاستلام • ⭐ تُضاف نقاطك التشجيعية بعد التوصيل
              </AppText>
            </View>
            <View style={styles.successActions}>
              <Pressable style={styles.successPrimary} onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, trackingY - 12), animated: true })}>
                <AppText weight="bold" style={styles.successPrimaryText}>
                  تتبع الطلب
                </AppText>
              </Pressable>
              <Pressable style={styles.successOutline} onPress={() => router.navigate('/products')}>
                <AppText weight="bold" style={styles.successOutlineText}>
                  متابعة التسوق
                </AppText>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <AppText weight="bold" style={styles.orderTitle}>
              طلب #{order.orderNumber}
            </AppText>
            <Ionicons name="cube-outline" size={22} color={colors.primary} />
          </View>
          <AppText muted style={styles.date}>
            تاريخ الطلب: {dateText}
          </AppText>
          {!!order.deliverySlotStart && <AppText muted style={styles.date}>موعد التوصيل: {formatDateTime(order.deliverySlotStart)}</AppText>}
          {!!tracking?.estimatedDelivery && <AppText muted style={styles.date}>التوصيل المتوقع: {formatDateTime(tracking.estimatedDelivery)}</AppText>}
          {timing?.totalMinutes != null && (
            <View style={styles.timing}>
              <Ionicons name="timer-outline" size={15} color={tc("#15803D")} />
              <AppText weight="medium" style={styles.timingText}>
                وصل طلبك خلال {fmtMinutes(timing.totalMinutes)}
              </AppText>
            </View>
          )}
          <View style={{ marginTop: 10 }}>
            <StatusBadge status={order.status} block />
          </View>
          {!!order.cancellationReason && <AppText style={[styles.problem, { marginTop: 8 }]}>سبب الإلغاء: {order.cancellationReason}</AppText>}
        </View>

        {order.status === 'DELIVERY_FAILED' && (
          <View style={styles.failed}>
            <Ionicons name="alert-circle-outline" size={20} color={tc("#F97316")} />
            <View style={{ flex: 1 }}>
              <AppText weight="bold" style={{ color: tc('#7C2D12') }}>
                تعذّر تسليم طلبك
              </AppText>
              <AppText style={{ color: tc('#9A3412'), fontSize: 14 }}>
                لم يتمكن السائق من تسليم الطلب، فتعود البضاعة إلى المتجر ولا تدفع ثمنها. يمكنك طلبها من جديد متى شئت.
              </AppText>
            </View>
          </View>
        )}

        {!hideTracking && !!tracking?.timeline.length && (
          <View style={styles.card} onLayout={(e) => setTrackingY(e.nativeEvent.layout.y)}>
            <AppText weight="bold" style={styles.section}>
              تتبع الطلب
            </AppText>
            {drivers.map((s) => (
              <Pressable key={s.subOrderId} style={styles.driver} onPress={() => call(s.driver!.driverPhone)}>
                <View style={styles.driverIcon}>
                  <Ionicons name="call-outline" size={16} color={tc("#2563EB")} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText weight="medium" style={{ color: tc('#1E3A8A') }}>
                    {s.driver!.driverName}
                  </AppText>
                  <AppText style={styles.driverPhone}>{`‎${s.driver!.driverPhone}`}</AppText>
                </View>
              </Pressable>
            ))}
            {tracking.timeline.map((step, index) => (
              <View key={`${step.status}-${index}`} style={styles.step}>
                <View style={styles.rail}>
                  <View style={[styles.dot, step.isCompleted && styles.dotDone]} />
                  {index < tracking.timeline.length - 1 && <View style={[styles.line, step.isCompleted && styles.lineDone]} />}
                </View>
                <View style={{ flex: 1, paddingBottom: index < tracking.timeline.length - 1 ? 24 : 0 }}>
                  <AppText weight="medium" style={[styles.stepLabel, !step.isCompleted && { color: colors.placeholder }]}>
                    {step.statusAr}
                  </AppText>
                  {step.isCompleted && !!step.occurredAt && (
                    <AppText muted style={styles.small}>
                      {formatDateTime(step.occurredAt)}
                    </AppText>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <AppText weight="bold" style={styles.section}>
            المنتجات ({items.length})
          </AppText>
          {items.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Ionicons name="cube-outline" size={48} color={tc("#D1D5DB")} />
              <AppText muted style={{ marginTop: 8 }}>لا توجد منتجات في هذا الطلب</AppText>
            </View>
          ) : (
            items.map(({ item, delivered: canRate }, index) => (
              <ItemRow
                key={item.id}
                item={item}
                divider={index > 0}
                onRate={
                  canRate
                    ? () =>
                        router.push({
                          pathname: '/review-new',
                          params: { productId: item.productId, orderId: order.id, name: item.productNameAr || item.productName },
                        })
                    : undefined
                }
              />
            ))
          )}
        </View>

        {delivered && <OrderRatingForm order={order} />}

        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <AppText weight="bold" style={styles.cardTitleText}>
              عنوان التوصيل
            </AppText>
          </View>
          {!!order.customerName && (
            <AppText weight="medium" style={styles.addrName}>
              {order.customerName}
            </AppText>
          )}
          {!!order.deliveryPhone && (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={14} color={colors.textMuted} />
              <AppText style={styles.phone}>{order.deliveryPhone}</AppText>
            </View>
          )}
          {!!order.deliveryAddress && <AppText style={styles.addrText}>{order.deliveryAddress}</AppText>}
          {!!order.customerNotes && <AppText muted style={styles.small}>ملاحظاتك: {order.customerNotes}</AppText>}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <Ionicons name="card-outline" size={18} color={colors.primary} />
            <AppText weight="bold" style={styles.cardTitleText}>
              الدفع
            </AppText>
          </View>
          <View style={styles.row}>
            <AppText style={styles.rowMuted}>طريقة الدفع</AppText>
            <AppText>{paymentMethodLabel(order.paymentMethod)}</AppText>
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <AppText style={styles.rowMuted}>حالة الدفع</AppText>
            {order.status === 'CANCELLED' ? (
              <AppText muted style={styles.small}>لا يوجد دفع</AppText>
            ) : (
              <PaymentBadge status={order.paymentStatus || 'PENDING'} />
            )}
          </View>
        </View>

        <View style={styles.card}>
          <AppText weight="bold" style={styles.cardTitleText}>
            ملخص الطلب
          </AppText>
          <View style={{ gap: 8, marginTop: 12 }}>
            <Row label="المجموع الفرعي" value={formatPrice(order.subtotal)} />
            <Row label="الشحن" value={order.deliveryFees === 0 ? 'مجاني' : formatPrice(order.deliveryFees)} />
            {order.couponDiscountAmount > 0 && (
              <Row label={`خصم الكوبون${order.couponCode ? ` (${order.couponCode})` : ''}`} value={`-${formatPrice(order.couponDiscountAmount)}`} green />
            )}
            {order.pointsDiscountAmount > 0 && <Row label="خصم النقاط" value={`-${formatPrice(order.pointsDiscountAmount)}`} green />}
            {refusalOnly && <Row label="الخصم" value={`-${formatPrice(order.discountAmount)}`} green />}
          </View>
          <View style={styles.totalRow}>
            <AppText weight="bold" style={{ fontSize: 16 }}>
              الإجمالي
            </AppText>
            <AppText weight="bold" style={styles.totalValue}>
              {formatPrice(order.totalAmount)}
            </AppText>
          </View>
          {order.refusedAmount > 0 && (
            <View style={{ marginTop: 8 }}>
              <Row label="قطع رُفضت عند الاستلام (غير محتسبة)" value={formatPrice(order.refusedAmount)} small />
            </View>
          )}
        </View>

        <View style={{ gap: 8 }}>
          {delivered && (
            <Pressable style={styles.invoice} onPress={viewInvoice} disabled={invoiceBusy}>
              {invoiceBusy ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="open-outline" size={14} color={colors.primary} />}
              <Ionicons name="document-text-outline" size={16} color={colors.primary} />
              <AppText weight="medium" style={{ color: colors.primary, fontSize: 15 }}>
                عرض الفاتورة
              </AppText>
            </Pressable>
          )}
          {(delivered || order.status === 'CANCELLED') && (
            <Button title="إعادة الطلب" variant="outline" loading={reordering} onPress={reorder} />
          )}
          {delivered && (
            <Button
              title="طلب إرجاع"
              variant="outline"
              onPress={() => router.push({ pathname: '/return-new', params: { orderId: order.id } })}
            />
          )}
          {canCancelOrder(order) && (
            <Pressable style={styles.cancelButton} onPress={() => setCancelOpen(true)}>
              <AppText weight="bold" style={styles.cancelText}>
                إلغاء الطلب
              </AppText>
            </Pressable>
          )}
          <Pressable style={styles.backButton} onPress={() => router.navigate('/orders')}>
            <Ionicons name="arrow-forward" size={16} color={tc("#374151")} />
            <AppText weight="medium" style={{ color: tc('#374151') }}>
              العودة للطلبات
            </AppText>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={cancelOpen} transparent animationType="fade" onRequestClose={() => setCancelOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <AppText weight="extraBold" style={styles.section}>
              إلغاء الطلب
            </AppText>
            <AppText muted style={styles.small}>
              الإلغاء متاح قبل بدء التحضير فقط. اكتب السبب:
            </AppText>
            <TextInput
              value={reason}
              onChangeText={(t) => {
                setReason(t);
                setReasonError('');
              }}
              placeholder="سبب الإلغاء"
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={500}
              style={styles.input}
            />
            {!!reasonError && <AppText style={styles.problem}>{reasonError}</AppText>}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="تأكيد الإلغاء" loading={cancel.isPending} onPress={confirmCancel} style={{ flex: 1 }} />
              <Button title="رجوع" variant="outline" onPress={() => setCancelOpen(false)} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ItemRow({ item, divider, onRate }: { item: OrderItem; divider?: boolean; onRate?: () => void }) {
  useTheme();
  const image = getImageUrl(item.productImageUrl, IMG_SIZE.THUMB);
  return (
    <View style={[styles.item, divider && styles.itemDivider]}>
      <Pressable onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.productId } })}>
        {image ? <Image source={{ uri: image }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText weight="medium" style={styles.itemName}>
          {item.productNameAr || item.productName}
        </AppText>
        <AppText muted style={styles.small}>
          الكمية: {formatQuantity(item.quantity, item.weightStepKg)}
        </AppText>
        {item.unavailableQuantity > 0 && (
          <AppText style={styles.amber}>غير متوفر: {formatQuantity(item.unavailableQuantity, item.weightStepKg)} — أُزيل من الطلب</AppText>
        )}
        {item.refusedQuantity > 0 && (
          <AppText style={styles.problem}>رُفض عند الاستلام: {formatQuantity(item.refusedQuantity, item.weightStepKg)} — لم يُحتسب عليك</AppText>
        )}
        <AppText weight="bold" style={styles.unitPrice}>
          {formatPrice(item.unitPrice || 0, item.weightStepKg)}
        </AppText>
        {!!onRate && (
          <Pressable onPress={onRate} hitSlop={6}>
            <AppText weight="bold" style={{ color: colors.primary, fontSize: 13 }}>
              ★ قيّم المنتج
            </AppText>
          </Pressable>
        )}
      </View>
      <AppText weight="bold" style={styles.itemTotal}>
        {formatPrice(item.subtotal || 0)}
      </AppText>
    </View>
  );
}

function Row({ label, value, green, small }: { label: string; value: string; green?: boolean; small?: boolean }) {
  useTheme();
  const color = green ? tc('#16A34A') : small ? colors.textMuted : tc('#4B5563');
  return (
    <View style={styles.row}>
      <AppText style={{ fontSize: small ? 12 : 14, color, flex: 1 }}>{label}</AppText>
      <AppText style={{ fontSize: small ? 12 : 14, color }}>{value}</AppText>
    </View>
  );
}

const paymentMethodLabel = (method: string) =>
  ['COD', 'cash'].includes(method) ? '💵 عند الاستلام' : ['ZAINCASH', 'zaincash'].includes(method) ? '📱 زين كاش' : ['CARD', 'card'].includes(method) ? '💳 بطاقة' : method;

const PAYMENT_STATUS = createThemed<Record<string, { label: string; bg: string; fg: string }>>(() => ({
  PENDING: { label: 'بانتظار الدفع', bg: tc('#FEF3C7'), fg: tc('#B45309') },
  PAID: { label: 'مدفوع', bg: colors.successLight, fg: tc('#047857') },
  FAILED: { label: 'فشل', bg: colors.errorLight, fg: colors.errorDark },
  REFUNDED: { label: 'مسترد', bg: tc('#E5E7EB'), fg: tc('#374151') },
}));

function PaymentBadge({ status }: { status: string }) {
  useTheme();
  const tone = PAYMENT_STATUS[status.toUpperCase()] ?? { label: status, bg: tc('#F3F4F6'), fg: tc('#374151') };
  return (
    <View style={[styles.payBadge, { backgroundColor: tone.bg }]}>
      <AppText weight="medium" style={{ color: tone.fg, fontSize: 12, lineHeight: 18 }}>
        {tone.label}
      </AppText>
    </View>
  );
}

const styles = createStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: 16, paddingBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitleText: { fontSize: 16 },
  section: { fontSize: 18, marginBottom: 16 },
  small: { fontSize: 13 },
  problem: { color: colors.errorDark, fontSize: 13 },
  amber: { color: '#B45309', fontSize: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  orderTitle: { flex: 1, fontSize: 22 },
  date: { fontSize: 14, marginTop: 4 },
  failed: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FED7AA', backgroundColor: '#FFF7ED' },
  step: { flexDirection: 'row', gap: 16 },
  rail: { alignItems: 'center', width: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#D1D5DB' },
  dotDone: { backgroundColor: '#22C55E' },
  line: { position: 'absolute', top: 16, bottom: -24, width: 4, backgroundColor: colors.border },
  lineDone: { backgroundColor: '#22C55E' },
  stepLabel: { fontSize: 16, color: '#111827' },
  driver: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 16, borderRadius: 8, borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: '#EFF6FF' },
  driverIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  driverPhone: { color: '#2563EB', fontSize: 14, writingDirection: 'ltr', textAlign: 'right' },
  item: { flexDirection: 'row', gap: 16, paddingVertical: 16 },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  thumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: brand.surfaceMuted },
  itemName: { fontSize: 15, color: '#111827' },
  unitPrice: { color: colors.primary, marginTop: 4, fontSize: 14 },
  itemTotal: { fontSize: 14, flexShrink: 0 },
  rateCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 16, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  addrName: { fontSize: 15, color: '#111827', marginBottom: 4 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  phone: { fontSize: 14, color: '#4B5563', writingDirection: 'ltr' },
  addrText: { fontSize: 14, color: '#4B5563' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowMuted: { color: '#4B5563' },
  payBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  totalValue: { fontSize: 16, color: colors.primary },
  timing: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#F0FDF4', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  timingText: { color: '#15803D', fontSize: 14 },
  invoice: { height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cancelButton: { height: 48, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.white, fontSize: 16 },
  backButton: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  successCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: '#BBF7D0', overflow: 'hidden' },
  successTop: { backgroundColor: '#F0FDF4', paddingHorizontal: 20, paddingTop: 32, paddingBottom: 20, alignItems: 'center' },
  successArt: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successPing: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(74,222,128,0.3)' },
  successCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#22C55E', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  successTitle: { fontSize: 22, textAlign: 'center' },
  successText: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 20, alignSelf: 'stretch' },
  tile: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12 },
  tileLabel: { fontSize: 12 },
  tileValue: { fontSize: 14, marginTop: 2 },
  successNote: { fontSize: 12, textAlign: 'center', marginTop: 16 },
  successActions: { flexDirection: 'row', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  successPrimary: { flex: 1, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  successPrimaryText: { color: colors.white, fontSize: 14 },
  successOutline: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  successOutlineText: { color: '#1F2937', fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 80,
    fontFamily: fonts.regular,
    fontSize: 15,
    textAlign: 'right',
    textAlignVertical: 'top',
  },
}));
