import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  allMissing,
  formatDateTime,
  formatQuantity,
  getImageUrl,
  itemTitle,
  missingCount,
  nextOrderStep,
  ORDER_STATUS_LABELS,
  partialSubtotal,
  toUnavailableItems,
  type VendorOrder,
  type VendorOrderItem,
  type VendorProduct,
} from '@wasit/shared';
import { AppText, colors, createStyles, useTheme , tc } from '@wasit/ui';
import { useOrder, useOrderActions, useProducts } from '../../api/useVendor';
import { ActionButton, callPhone, Card, Chip, ltr, money, Screen, SectionTitle, whatsappUrl } from '../../components/kit';
import { Countdown, statusTone } from '../../components/OrderCard';
import { RejectSheet } from '../../components/RejectSheet';
import { toast } from '../../lib/toast';
import { palette } from '../../lib/palette';

const slotText = (start?: string | null, end?: string | null) => (start ? `${formatDateTime(start)}${end ? ` ← ${formatDateTime(end)}` : ''}` : null);

// تفاصيل الطلب: القبول والرفض والقبول الجزئي مع البدائل، ثم التحضير فالجاهزية
export default function OrderScreen() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useOrder(id);
  const actions = useOrderActions();
  const products = useProducts();
  const [partial, setPartial] = useState(false);
  const [missing, setMissing] = useState<Record<string, number>>({});
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const o = query.data;

  if (!o) {
    return (
      <Screen title="تفاصيل الطلب" back>
        <AppText muted style={{ textAlign: 'center', paddingVertical: 40 }}>{query.isError ? 'تعذّر تحميل الطلب' : 'جاري التحميل...'}</AppText>
      </Screen>
    );
  }

  const pending = o.status === 'PENDING_CONFIRMATION';
  const next = nextOrderStep(o.status);
  const canReplace = o.substitutionPreference === 'SIMILAR';
  const wa = whatsappUrl(o.customerPhone);

  // بدائل: منتجات المتجر الظاهرة والمتوفرة بلا متغيرات (لا يدفع الزبون أكثر من سعر الأصلي)
  const pool: VendorProduct[] = (products.data ?? []).filter((p) => p.isActive && p.isAvailable && p.stockQuantity > 0 && !p.hasVariants);
  const replacementPrice = (it: VendorOrderItem) => {
    const product = pool.find((p) => p.id === replacements[it.id]);
    return product ? Math.min(product.price, it.unitPrice) * (missing[it.id] || 0) : 0;
  };
  const setMissingFor = (it: VendorOrderItem, n: number) => setMissing((m) => ({ ...m, [it.id]: Math.max(0, Math.min(it.quantity, n)) }));
  const newSubtotal = partialSubtotal(o.items, missing, replacementPrice);

  const run = async (fn: () => Promise<unknown>, ok: string, after?: () => void) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      after?.();
      query.refetch();
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّر تنفيذ العملية');
    } finally {
      setBusy(false);
    }
  };

  const footer = pending ? (
    partial ? (
      <>
        <ActionButton title="تراجع" tone="ghost" disabled={busy} onPress={() => { setPartial(false); setMissing({}); setReplacements({}); }} />
        <ActionButton
          title="قبول المتوفر"
          icon="checkmark"
          loading={busy}
          disabled={missingCount(missing) === 0 || allMissing(o.items, missing)}
          onPress={() => run(() => actions.confirm.mutateAsync({ id: o.subOrderId, unavailable: toUnavailableItems(missing, replacements, canReplace) }), 'تم قبول الطلب بالقطع المتوفرة', () => setPartial(false))}
        />
      </>
    ) : (
      <>
        <ActionButton title="رفض" tone="bad" disabled={busy} onPress={() => setRejecting(true)} />
        <ActionButton title="قبول الطلب" icon="checkmark" loading={busy} onPress={() => run(() => actions.confirm.mutateAsync({ id: o.subOrderId }), 'تم قبول الطلب')} />
      </>
    )
  ) : next ? (
    <ActionButton
      title={next.label}
      tone={next.step === 'ready' ? 'ok' : 'primary'}
      loading={busy}
      onPress={() => run(() => (next.step === 'preparing' ? actions.preparing.mutateAsync(o.subOrderId) : actions.ready.mutateAsync(o.subOrderId)), next.step === 'preparing' ? 'بدأ تحضير الطلب' : 'الطلب جاهز، أُبلغ فريق التوصيل')}
    />
  ) : undefined;

  return (
    <Screen
      title={o.subOrderNumber}
      subtitle={formatDateTime(o.createdAt)}
      back
      footer={footer}
      refreshing={query.isRefetching}
      onRefresh={() => query.refetch()}
      right={pending ? <Countdown deadline={o.confirmationDeadline} /> : <Chip label={ORDER_STATUS_LABELS[o.status] ?? o.status} tone={statusTone(o.status)} />}
    >
      {!!slotText(o.deliverySlotStart, o.deliverySlotEnd) && (
        <Card>
          <AppText weight="bold" style={{ fontSize: 13 }}>موعد التسليم</AppText>
          <AppText style={{ fontSize: 14 }}>{slotText(o.deliverySlotStart, o.deliverySlotEnd)}</AppText>
          {!!o.substitutionPreference && <AppText muted style={{ fontSize: 12.5 }}>{o.substitutionPreference === 'SIMILAR' ? 'إن نقصت قطعة: استبدلها بمشابه' : 'إن نقصت قطعة: احذفها وأعد المبلغ'}</AppText>}
        </Card>
      )}

      {!!o.customerNotes && (
        <Card tone="warn">
          <AppText weight="extraBold" style={{ fontSize: 13, color: palette.warnText }}>ملاحظة الزبون</AppText>
          <AppText style={{ fontSize: 15, lineHeight: 24 }}>{o.customerNotes}</AppText>
        </Card>
      )}

      <Card>
        <AppText weight="extraBold" style={{ fontSize: 16 }}>{o.customerName}</AppText>
        {!!o.deliveryAddress && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Ionicons name="location-outline" size={17} color={colors.textMuted} />
            <AppText muted style={{ flex: 1, fontSize: 13.5, lineHeight: 22 }}>{o.deliveryAddress}</AppText>
          </View>
        )}
        {!!o.customerPhone && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ActionButton title="اتصال" icon="call-outline" tone="ghost" onPress={() => callPhone(o.customerPhone)} compact />
            {wa && <ActionButton title="واتساب" icon="logo-whatsapp" tone="soft" onPress={() => Linking.openURL(wa)} compact />}
          </View>
        )}
      </Card>

      {partial && (
        <Card>
          <AppText style={{ fontSize: 13.5, lineHeight: 23 }}>
            حدّد عدد القطع <AppText weight="bold" style={{ fontSize: 13.5 }}>غير المتوفرة</AppText> من كل منتج. تُزال من الطلب ويُبلَّغ الزبون بالمبلغ الجديد.
            {canReplace ? ' الزبون يقبل بديلاً مشابهاً: اختره من منتجاتك، ويُحسب بسعر لا يزيد عن الأصلي.' : ''}
          </AppText>
        </Card>
      )}

      <SectionTitle>المنتجات</SectionTitle>
      <Card pad={4}>
        {o.items.map((it, i) => {
          const m = missing[it.id] || 0;
          const gone = it.quantity === 0;
          const options = pool.filter((p) => p.id !== it.productId && p.stockQuantity >= m);
          return (
            <View key={it.id} style={[styles.item, i > 0 && { borderTopWidth: 1, borderTopColor: tc('#F8ECDA') }]}>
              <View style={styles.itemRow}>
                <View style={styles.thumb}>{it.productImageUrl ? <Image source={{ uri: getImageUrl(it.productImageUrl, 200) ?? undefined }} style={{ flex: 1 }} contentFit="cover" /> : null}</View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText weight="bold" style={[{ fontSize: 14.5 }, gone && { textDecorationLine: 'line-through' }]} numberOfLines={2}>{it.productNameAr || it.productName}</AppText>
                  {!!it.variantLabel && <AppText weight="bold" style={{ fontSize: 12.5, color: colors.primaryHover }}>{it.variantLabel}{it.variantSku ? ` · ${it.variantSku}` : ''}</AppText>}
                  <AppText muted style={{ fontSize: 12.5 }}>× {ltr(formatQuantity(it.quantity, it.weightStepKg))}</AppText>
                  <ItemNotes it={it} items={o.items} />
                </View>
                {partial ? (
                  <View style={styles.stepper}>
                    <Pressable onPress={() => setMissingFor(it, m - 1)} disabled={m === 0} style={[styles.stepBtn, m === 0 && { opacity: 0.4 }]} accessibilityLabel="إنقاص"><AppText weight="bold" style={{ fontSize: 18 }}>−</AppText></Pressable>
                    <AppText weight="extraBold" style={{ minWidth: 22, textAlign: 'center', color: m > 0 ? colors.errorDark : colors.textMuted }}>{m}</AppText>
                    <Pressable onPress={() => setMissingFor(it, m + 1)} disabled={m >= it.quantity} style={[styles.stepBtn, m >= it.quantity && { opacity: 0.4 }]} accessibilityLabel="زيادة"><AppText weight="bold" style={{ fontSize: 18 }}>+</AppText></Pressable>
                  </View>
                ) : (
                  <AppText weight="bold">{money(it.subtotal)}</AppText>
                )}
              </View>
              {partial && canReplace && m > 0 && (
                <View style={{ gap: 6 }}>
                  <AppText muted style={{ fontSize: 12.5 }}>البديل (اختياري):</AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <Pressable onPress={() => setReplacements((r) => ({ ...r, [it.id]: '' }))} style={[styles.opt, !replacements[it.id] && styles.optOn]}><AppText style={{ fontSize: 12.5 }}>بلا بديل</AppText></Pressable>
                    {options.slice(0, 12).map((p) => (
                      <Pressable key={p.id} onPress={() => setReplacements((r) => ({ ...r, [it.id]: p.id }))} style={[styles.opt, replacements[it.id] === p.id && styles.optOn]}>
                        <AppText style={{ fontSize: 12.5 }}>{p.nameAr || p.name} · {Math.round(Math.min(p.price, it.unitPrice)).toLocaleString('en-US')}</AppText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </Card>

      <Card>
        <Line label="المجموع الفرعي" value={money(partial ? newSubtotal : o.subtotal)} />
        <Line label="التوصيل" value={money(o.deliveryFee)} />
        <Line label="الإجمالي" value={money((partial ? newSubtotal : o.subtotal ?? 0) + (o.deliveryFee ?? 0))} strong />
        {!partial && o.vendorDiscount > 0 && <Line label="كوبون متجرك (يُخصم من مستحقك)" value={`−${money(o.vendorDiscount)}`} bad />}
        {!partial && o.platformDiscount > 0 && <Line label="خصم المنصة (لا يُخصم منك)" value={`−${money(o.platformDiscount)}`} />}
        {!partial && (o.vendorDiscount > 0 || o.platformDiscount > 0) && <Line label="يدفعه الزبون" value={money(o.customerPays)} strong />}
      </Card>

      {o.returns?.length > 0 && (
        <>
          <SectionTitle>إرجاعات هذا الطلب</SectionTitle>
          {o.returns.map((r) => (
            <Card key={r.id} tone="bad">
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <AppText weight="extraBold" style={{ flex: 1, writingDirection: 'ltr', textAlign: 'right' }}>{r.returnNumber}</AppText>
                <Chip label={r.isDoorRefusal ? 'رفض عند الباب' : r.status} tone="bad" />
              </View>
              <AppText muted style={{ fontSize: 13 }}>{r.reason}{r.details ? ` — ${r.details}` : ''}</AppText>
              {r.items?.length > 0 && <AppText style={{ fontSize: 13 }}>{r.items.map((i) => `${i.productName} ${ltr(`×${i.quantity}`)}`).join('، ')}</AppText>}
            </Card>
          ))}
        </>
      )}

      {!!o.cancellationReason && (
        <Card tone="bad">
          <AppText weight="extraBold" style={{ fontSize: 13, color: colors.errorDark }}>سبب الإلغاء</AppText>
          <AppText>{o.cancellationReason}</AppText>
        </Card>
      )}

      {!!(o.failureReasonAr || o.failureNote) && (
        <Card tone="bad">
          <AppText weight="extraBold" style={{ fontSize: 13, color: colors.errorDark }}>سبب تعذّر التسليم</AppText>
          {!!o.failureReasonAr && <AppText>{o.failureReasonAr}</AppText>}
          {!!o.failureNote && <AppText muted style={{ fontSize: 13 }}>{o.failureNote}</AppText>}
        </Card>
      )}

      {pending && !partial && o.items.length > 0 && (
        <Pressable onPress={() => setPartial(true)} style={{ alignItems: 'center', padding: 8 }}>
          <AppText weight="medium" style={{ color: colors.primaryHover, textDecorationLine: 'underline' }}>بعض القطع غير متوفرة؟ اقبل المتوفر فقط</AppText>
        </Pressable>
      )}

      <RejectSheet
        order={rejecting ? o : null}
        busy={busy}
        onClose={() => setRejecting(false)}
        onSubmit={(reason) => run(() => actions.reject.mutateAsync({ id: o.subOrderId, reason }), 'تم رفض الطلب', () => setRejecting(false))}
      />
    </Screen>
  );
}

function Line({ label, value, strong, bad }: { label: string; value: string; strong?: boolean; bad?: boolean }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <AppText weight={strong ? 'extraBold' : 'regular'} muted={!strong} style={{ fontSize: strong ? 16 : 14, color: bad ? colors.errorDark : undefined }}>{label}</AppText>
      <AppText weight={strong ? 'extraBold' : 'medium'} style={{ fontSize: strong ? 16 : 14, color: bad ? colors.errorDark : undefined }}>{value}</AppText>
    </View>
  );
}

// كميات خاصة بكل قطعة: مرفوضة عند الباب، مُرجعة، غير متوفرة عند القبول، أو بديل عن قطعة
function ItemNotes({ it, items }: { it: VendorOrderItem; items: VendorOrderItem[] }) {
  useTheme();
  const replaced = it.replacesItemId ? items.find((x) => x.id === it.replacesItemId) : null;
  const notes = [
    it.replacesItemId && { text: `بديل عن ${replaced ? itemTitle(replaced) : 'قطعة غير متوفرة'}`, tone: 'ok' as const },
    it.unavailableQuantity > 0 && { text: `${formatQuantity(it.unavailableQuantity, it.weightStepKg)} غير متوفرة، أُزيلت`, tone: 'muted' as const },
    it.refusedQuantity > 0 && { text: `${it.refusedQuantity} رفضها الزبون عند الباب`, tone: 'warn' as const },
    it.returnedQuantity > 0 && { text: `${it.returnedQuantity} أُرجعت`, tone: 'bad' as const },
  ].filter(Boolean) as { text: string; tone: 'ok' | 'muted' | 'warn' | 'bad' }[];
  if (notes.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {notes.map((n, i) => <Chip key={i} label={n.text} tone={n.tone} />)}
    </View>
  );
}

const styles = createStyles(() => ({
  item: { padding: 12, gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 52, height: 52, borderRadius: 14, backgroundColor: tc('#F8ECDA'), overflow: 'hidden' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { width: 34, height: 34, borderRadius: 11, backgroundColor: tc('#F8ECDA'), alignItems: 'center', justifyContent: 'center' },
  opt: { borderRadius: 99, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 6 },
  optOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
}));
