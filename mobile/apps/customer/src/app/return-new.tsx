import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  formatPrice,
  formatQuantity,
  returnedQuantities,
  returnLineKey,
  RETURN_REASONS,
  validateReturn,
  type ApiError,
  type PickedImage,
  type ReturnErrors,
  type ReturnReason,
} from '@wasit/shared';
import { AppText, AuthCard, AuthLayout, Button, ErrorBanner, Input, colors, radius, spacing, createStyles, useTheme } from '@wasit/ui';
import { useOrder, useOrders } from '../api/useOrders';
import { useCreateReturn, useMyReturns } from '../api/useFeedback';
import { ImagePickerRow } from '../components/ImagePickerRow';
import { QuantityStepper } from '../components/QuantityStepper';
import { toast } from '../lib/toast';

export default function NewReturnScreen() {
  useTheme();
  const { orderId: orderParam } = useLocalSearchParams<{ orderId?: string }>();
  const [pickedOrder, setPickedOrder] = useState('');
  const orderId = orderParam || pickedOrder;
  const { data: myOrders } = useOrders();
  const deliveredOrders = (myOrders ?? []).filter((o) => o.subOrders.some((s) => s.status === 'DELIVERED'));
  const { data: order, isLoading } = useOrder(orderId);
  const create = useCreateReturn();
  const { data: myReturns } = useMyReturns();
  const returnedBefore = useMemo(() => returnedQuantities(orderId, myReturns ?? []), [orderId, myReturns]);

  // الكمية المختارة لكل قطعة (0 = غير مختارة)
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason | ''>('');
  const [details, setDetails] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [errors, setErrors] = useState<ReturnErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // ما يمكن إرجاعه: ما وصل فعلاً (لا غير المتوفر ولا المرفوض عند الباب)
  const items = useMemo(
    () =>
      (order?.subOrders ?? [])
        .filter((s) => s.status === 'DELIVERED')
        .flatMap((s) => s.items)
        .map((i) => {
          const received = i.quantity - i.unavailableQuantity - i.refusedQuantity;
          const returned = Math.min(received, returnedBefore[returnLineKey(i.productId, i.variantId)] ?? 0);
          return { item: i, max: received - returned, returned, received };
        })
        // ما لم يصل أصلاً لا يظهر؛ ما أُرجع كله يظهر مشطوباً وغير قابل للاختيار
        .filter((x) => x.received > 0),
    [order, returnedBefore],
  );
  const selectable = items.some((x) => x.max > 0);

  if (isLoading && !!orderId) {
    return (
      <AuthLayout title="طلب إرجاع">
        <ActivityIndicator color={colors.primary} />
      </AuthLayout>
    );
  }

  const submit = async () => {
    const lines = items
      .filter(({ item }) => (quantities[item.id] ?? 0) > 0)
      .map(({ item }) => ({ productId: item.productId, variantId: item.variantId, quantity: quantities[item.id] }));
    const found = validateReturn({ reason, items: lines, details });
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    try {
      const record = await create.mutateAsync({ orderId, reason: reason as ReturnReason, details, items: lines, images });
      toast.success(`رقم الطلب: ${record.returnNumber} — سنراجعه ونُعلمك بالقرار`, { title: 'تم إرسال طلب الإرجاع', duration: 6000 });
      router.replace('/returns');
    } catch (e) {
      setServerError((e as ApiError).message || 'تعذّر إرسال طلب الإرجاع');
    }
  };

  return (
    <AuthLayout title="طلب إرجاع" subtitle={order ? `الطلب ${order.orderNumber}` : undefined}>
      <AuthCard>
        {serverError && <ErrorBanner title="تعذّر الإرسال" message={serverError} />}

        {!orderParam && (
          <>
            <AppText weight="bold">الطلب *</AppText>
            {deliveredOrders.length === 0 ? (
              <AppText muted>لا توجد طلبات مسلَّمة يمكن إرجاعها.</AppText>
            ) : (
              <View style={styles.reasons}>
                {deliveredOrders.map((o) => (
                  <Pressable
                    key={o.id}
                    onPress={() => {
                      setPickedOrder(o.id);
                      setQuantities({});
                    }}
                    style={[styles.reason, pickedOrder === o.id && styles.reasonActive]}
                  >
                    <AppText weight="medium" style={[styles.small, pickedOrder === o.id && { color: colors.white }]}>
                      {o.orderNumber}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}

        <AppText weight="bold">المنتجات المراد إرجاعها</AppText>
        {!orderId ? (
          <AppText muted>اختر الطلب أولاً.</AppText>
        ) : items.length === 0 ? (
          <AppText muted>لا توجد منتجات قابلة للإرجاع في هذا الطلب.</AppText>
        ) : (
          items.map(({ item, max, returned }) => (
            <View key={item.id} style={[styles.item, max <= 0 && { opacity: 0.55 }]}>
              <View style={{ flex: 1 }}>
                <AppText weight="medium" numberOfLines={2} style={max <= 0 && { textDecorationLine: 'line-through' }}>
                  {item.productNameAr || item.productName}
                </AppText>
                <AppText muted style={styles.small}>
                  {max <= 0
                    ? 'تم إرجاعه'
                    : `${formatPrice(item.unitPrice, item.weightStepKg)} · الحد الأقصى ${formatQuantity(max, item.weightStepKg)}${returned > 0 ? ` (أُرجع ${formatQuantity(returned, item.weightStepKg)})` : ''}`}
                </AppText>
              </View>
              <QuantityStepper
                disabled={max <= 0}
                value={quantities[item.id] ?? 0}
                min={0}
                max={max}
                weightStepKg={item.weightStepKg}
                onChange={(q) => {
                  setQuantities((p) => ({ ...p, [item.id]: q }));
                  setErrors((p) => ({ ...p, items: undefined }));
                }}
              />
            </View>
          ))
        )}
        {!!errors.items && <AppText style={styles.error}>{errors.items}</AppText>}

        <AppText weight="bold">سبب الإرجاع</AppText>
        <View style={styles.reasons}>
          {RETURN_REASONS.map((r) => (
            <Pressable
              key={r.value}
              onPress={() => {
                setReason(r.value);
                setErrors((p) => ({ ...p, reason: undefined }));
              }}
              style={[styles.reason, reason === r.value && styles.reasonActive]}
            >
              <AppText weight="medium" style={[styles.small, reason === r.value && { color: colors.white }]}>
                {r.label}
              </AppText>
            </Pressable>
          ))}
        </View>
        {!!errors.reason && <AppText style={styles.error}>{errors.reason}</AppText>}

        <Input label="تفاصيل إضافية (اختياري)" value={details} onChangeText={setDetails} error={errors.details} multiline maxLength={1000} />
        <ImagePickerRow label="صور توضّح المشكلة (اختياري)" images={images} onChange={setImages} />
        <Button title="إرسال طلب الإرجاع" loading={create.isPending} disabled={!orderId || !selectable} onPress={submit} />
      </AuthCard>
      <Button title="إلغاء" variant="outline" onPress={() => router.back()} />
    </AuthLayout>
  );
}

const styles = createStyles(() => ({
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.sm },
  small: { fontSize: 13 },
  error: { color: colors.errorDark, fontSize: 13 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reason: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
  reasonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
}));
