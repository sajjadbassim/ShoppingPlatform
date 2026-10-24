import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  refusableQuantity,
  refusedCount,
  refusedValue,
  refusesAll,
  REFUSAL_REASONS,
  type DeliverPayload,
  type DriverOrder,
} from '@wasit/shared';
import { AppText, brand, Checkbox, colors, createStyles, radius, useTheme } from '@wasit/ui';
import { ActionButton, money } from './kit';

interface Props {
  order: DriverOrder | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: (payload: DeliverPayload) => void;
  // رفض كل القطع = رفض كامل: ينتقل المندوب إلى «تعذّر التسليم»
  onFullRefusal: (order: DriverOrder) => void;
}

// تأكيد التسليم: استلام المبلغ، وإن رفض الزبون بعض القطع عند الباب يحدّدها المندوب مع السبب
export function DeliverSheet({ order, loading, onClose, onConfirm, onFullRefusal }: Props) {
  useTheme();
  const insets = useSafeAreaInsets();
  const [cash, setCash] = useState(false);
  const [refused, setRefused] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');

  useEffect(() => {
    setCash(false);
    setRefused({});
    setReason('');
  }, [order?.orderId]);

  if (!order) return null;

  const needsCash = order.amountToCollect > 0;
  const hasRefusal = refusedCount(refused) > 0;
  const fullRefusal = refusesAll(order, refused);
  const blocked = (needsCash && !cash) || (hasRefusal && !reason);
  const items = order.stores.flatMap((s) => s.items).filter((i) => refusableQuantity(i) > 0);

  const setQty = (id: string, qty: number) => setRefused((p) => ({ ...p, [id]: qty }));

  const submit = () => {
    if (fullRefusal) return onFullRefusal(order);
    onConfirm({
      cashCollected: needsCash && cash,
      refusedItems: Object.entries(refused).filter(([, q]) => q > 0).map(([subOrderItemId, quantity]) => ({ subOrderItemId, quantity })),
      refusalReason: hasRefusal ? reason : undefined,
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <AppText weight="extraBold" style={{ fontSize: 18 }}>تأكيد التسليم</AppText>
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          {needsCash && (
            <View style={styles.cashBox}>
              <AppText muted style={{ fontSize: 13 }}>المبلغ المطلوب من الزبون</AppText>
              <AppText weight="extraBold" style={{ fontSize: 26, color: colors.primary }}>
                {money(Math.max(0, order.amountToCollect - refusedValue(order, refused)))}
              </AppText>
              <View style={{ alignSelf: 'stretch' }}>
                <Checkbox checked={cash} onChange={setCash} label="استلمت المبلغ كاملاً من الزبون" />
              </View>
            </View>
          )}

          <AppText weight="bold">رفض الزبون بعض القطع؟</AppText>
          {items.map((i) => {
            const max = refusableQuantity(i);
            const value = refused[i.subOrderItemId] ?? 0;
            return (
              <View key={i.subOrderItemId} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <AppText weight="medium" numberOfLines={2}>{i.name}</AppText>
                  <AppText muted style={{ fontSize: 12 }}>
                    {[i.variant, `${i.quantity} × ${money(i.unitPrice)}`].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
                <View style={styles.stepper}>
                  <Pressable onPress={() => setQty(i.subOrderItemId, Math.max(0, value - 1))} disabled={value <= 0} style={[styles.stepBtn, value <= 0 && { opacity: 0.3 }]} accessibilityLabel="إنقاص">
                    <AppText weight="bold">−</AppText>
                  </Pressable>
                  <AppText weight="bold" style={{ minWidth: 22, textAlign: 'center', color: value ? colors.errorDark : colors.placeholder }}>{value}</AppText>
                  <Pressable onPress={() => setQty(i.subOrderItemId, Math.min(max, value + 1))} disabled={value >= max} style={[styles.stepBtn, value >= max && { opacity: 0.3 }]} accessibilityLabel="زيادة">
                    <AppText weight="bold">+</AppText>
                  </Pressable>
                </View>
              </View>
            );
          })}

          {hasRefusal && !fullRefusal && (
            <>
              <AppText weight="bold">سبب الرفض</AppText>
              <View style={styles.chips}>
                {REFUSAL_REASONS.map((r) => (
                  <Pressable key={r.value} onPress={() => setReason(r.value)} style={[styles.chip, reason === r.value && styles.chipOn]}>
                    <AppText weight="bold" style={{ fontSize: 13, color: reason === r.value ? colors.white : colors.text }}>{r.label}</AppText>
                  </Pressable>
                ))}
              </View>
              <AppText muted style={{ fontSize: 12.5, lineHeight: 20 }}>
                يُخصم {money(refusedValue(order, refused))} وترجع القطع للمتجر معك.
                {!reason ? ' اختر السبب.' : ''}
              </AppText>
            </>
          )}
          {fullRefusal && (
            <AppText style={{ color: colors.errorDark, fontSize: 13 }}>رفض كل القطع يعني رفض الطلب كاملاً، وسننقلك إلى «تعذّر التسليم».</AppText>
          )}
        </ScrollView>
        <ActionButton
          title={fullRefusal ? 'متابعة: رفض كامل' : 'تم التسليم'}
          icon="checkmark"
          tone={fullRefusal ? 'bad' : 'ok'}
          loading={loading}
          disabled={!fullRefusal && blocked}
          onPress={submit}
        />
        <ActionButton title="إلغاء" tone="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = createStyles(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, gap: 12 },
  cashBox: { backgroundColor: colors.primaryLight, borderRadius: radius.xl, padding: 14, gap: 6, alignItems: 'flex-start' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: brand.ink, borderColor: brand.ink },
}));
