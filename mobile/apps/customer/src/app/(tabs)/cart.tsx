import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  canCheckout,
  countPieces,
  formatPrice,
  formatQuantity,
  getImageUrl,
  IMG_SIZE,
  maxQuantityFor,
  pricePerKg,
  useSessionStore,
  vendorUsesZones,
  type ApiError,
  type CartItem,
  type VendorCartSummary,
} from '@wasit/shared';
import { AppText, Button, brand, colors, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { useCart, useCartActions } from '../../api/useCart';
import { useLoyaltyEstimate, useZonesConfig } from '../../api/useCheckout';
import { useCoupon } from '../../api/useCoupon';
import { CouponBox } from '../../components/CouponBox';
import { EmptyCart } from '../../components/EmptyCart';
import { StickyBar } from '../../components/StickyBar';
import { toast } from '../../lib/toast';
import { confirmDialog } from '../../lib/dialog';

const lineOf = (item: CartItem) => ({ productId: item.productId, variantId: item.variantId });
const keyOf = (item: CartItem) => item.variantId || item.productId;
const money = (n: number) => `${Math.round(n).toLocaleString('en-US')} د.ع`;

export default function CartScreen() {
  useTheme();
  const signedIn = useSessionStore((s) => s.signedIn);
  const { data: cart, isLoading, isError, refetch } = useCart();
  const actions = useCartActions();
  const { data: zones } = useZonesConfig();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const subtotal = cart?.subtotal ?? 0;
  const coupon = useCoupon(subtotal);

  const vendors = cart?.vendorsSummary ?? [];
  const byZone = (v: VendorCartSummary) => vendorUsesZones(zones, v.vendorId);
  const anyByZone = vendors.some(byZone);
  const fixedFees = vendors.filter((v) => !byZone(v)).reduce((s, v) => s + (v.deliveryFee || 0), 0);
  const deliveryFees = anyByZone ? fixedFees : cart?.totalDeliveryFees ?? 0;
  const totalAmount = anyByZone ? subtotal + fixedFees : cart?.totalAmount ?? 0;
  const total = Math.max(0, totalAmount - coupon.discount);

  const allItems = vendors.flatMap((v) => v.items ?? []);
  const itemsCount = countPieces(allItems) || cart?.items.length || 0;
  const totalSavings = allItems.reduce((sum, i) => sum + (i.originalPrice && i.originalPrice > i.price ? (i.originalPrice - i.price) * i.quantity : 0), 0);

  // النقاط التي يكسبها الطلب تُمنح على ما يُدفع فعلاً بعد الكوبون (بلا التوصيل)
  const pointsBase = Math.max(0, subtotal - coupon.discount);
  const { data: estimate } = useLoyaltyEstimate(pointsBase, signedIn && pointsBase > 0);
  const pointsToEarn = estimate?.pointsToEarn ?? 0;

  const fail = (e: unknown) => toast.error((e as ApiError).message || 'تعذّر تنفيذ العملية');

  const updateQuantity = (item: CartItem, quantity: number) => {
    if (quantity < 1 || busyKey) return;
    setBusyKey(keyOf(item));
    actions.update.mutate({ ...lineOf(item), quantity }, { onError: fail, onSettled: () => setBusyKey(null) });
  };

  // زر الناقص يصبح حذفاً عندما تكون الكمية 1 (كما في الويب)
  const removeItem = (item: CartItem) => {
    if (busyKey) return;
    setBusyKey(keyOf(item));
    actions.remove.mutate(lineOf(item), { onError: fail, onSettled: () => setBusyKey(null) });
  };

  const confirmClear = () =>
    confirmDialog({
      title: 'إفراغ السلة',
      message: 'هل أنت متأكد من إفراغ السلة؟ ستُحذف كل المنتجات منها.',
      confirmText: 'إفراغ',
      tone: 'danger',
      icon: 'cart-outline',
      onConfirm: () => actions.clear.mutate(undefined, { onError: fail }),
    });

  // الزائر يرى السلة الفارغة مع تلميح الدخول (كما في الويب)
  if (!signedIn) return <EmptyCart />;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !cart) {
    return (
      <View style={styles.center}>
        <AppText weight="bold">تعذّر تحميل السلة</AppText>
        <Button title="إعادة المحاولة" onPress={() => refetch()} style={{ marginTop: spacing.md }} />
      </View>
    );
  }

  if (cart.items.length === 0) return <EmptyCart />;

  const ready = canCheckout(cart);
  const goCheckout = () => {
    if (!ready) {
      toast.warning('عالج ملاحظات السلة (متجر مغلق أو دون الحد الأدنى أو منتج غير متاح) أولاً', { title: 'لا يمكن إتمام الطلب' });
      return;
    }
    router.push('/checkout');
  };

  const feeText = (v: VendorCartSummary) => (byZone(v) ? 'حسب منطقتك' : money(v.deliveryFee));

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titleGroup}>
            <AppText weight="bold" style={styles.title}>
              السلة
            </AppText>
            <View style={styles.count}>
              <AppText weight="medium" style={styles.countText}>
                {itemsCount}
              </AppText>
            </View>
          </View>
          <Pressable style={styles.clear} onPress={confirmClear} disabled={actions.clear.isPending}>
            <Ionicons name="trash-outline" size={15} color={colors.error} />
            <AppText style={styles.clearText}>إفراغ السلة</AppText>
          </Pressable>
        </View>

        {cart.warnings?.map((w) => (
          <View key={w} style={styles.warning}>
            <Ionicons name="alert-circle-outline" size={20} color={tc("#CA8A04")} />
            <AppText style={styles.warningText}>{w}</AppText>
          </View>
        ))}

        {vendors.map((vendor) => {
          const remaining = Math.max(0, (vendor.minOrderAmount || 0) - (vendor.subtotal || 0));
          const progress = vendor.minOrderAmount > 0 ? Math.min(100, (vendor.subtotal / vendor.minOrderAmount) * 100) : 100;
          return (
            <View key={vendor.vendorId} style={styles.vendor}>
              <View style={styles.vendorHead}>
                <View style={styles.vendorRow}>
                  <View style={styles.vendorIcon}>
                    <Ionicons name="storefront-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText weight="bold" numberOfLines={1} style={styles.vendorName}>
                      {vendor.vendorNameAr || vendor.vendorName}
                    </AppText>
                    <View style={styles.vendorMeta}>
                      <View style={styles.inline}>
                        <Ionicons name="cube-outline" size={12} color={colors.textMuted} />
                        <AppText muted numberOfLines={1} style={styles.metaText}>
                          {vendor.itemsCount} منتج
                        </AppText>
                      </View>
                      <View style={styles.inline}>
                        <MaterialCommunityIcons name="truck-delivery-outline" size={13} color={colors.textMuted} />
                        <AppText muted numberOfLines={1} style={styles.metaText}>
                          توصيل {feeText(vendor)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                  <AppText weight="bold" numberOfLines={1} style={styles.vendorTotal}>
                    {money(vendor.subtotal)}
                  </AppText>
                </View>

                {vendor.minOrderAmount > 0 &&
                  (vendor.meetsMinimum ? (
                    <View style={[styles.inline, { marginTop: 10 }]}>
                      <Ionicons name="checkmark-circle-outline" size={14} color={tc("#15803D")} />
                      <AppText style={styles.minOk}>وصلت للحد الأدنى للطلب من هذا المتجر</AppText>
                    </View>
                  ) : (
                    <View style={{ marginTop: 10 }}>
                      <AppText style={styles.minNeed}>
                        أضف <AppText weight="bold" style={styles.minNeed}>{money(remaining)}</AppText> للوصول للحد الأدنى ({money(vendor.minOrderAmount)})
                      </AppText>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${progress}%` }]} />
                      </View>
                    </View>
                  ))}
                {!vendor.isOpen && <AppText style={styles.closed}>{vendor.closedMessage || 'المتجر مغلق الآن'}</AppText>}
              </View>

              {vendor.items.map((item, index) => {
                const image = getImageUrl(item.productImage, IMG_SIZE.THUMB);
                const busy = busyKey === keyOf(item);
                const lineTotal = item.subtotal || item.price * item.quantity;
                const hasOriginal = !!item.originalPrice && item.originalPrice > item.price;
                const atMax = item.quantity >= maxQuantityFor(item);
                return (
                  <View key={keyOf(item)} style={[styles.item, index > 0 && styles.itemDivider]}>
                    <Pressable onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.productId } })}>
                      {image ? (
                        <Image source={{ uri: image }} style={styles.thumb} contentFit="cover" />
                      ) : (
                        <View style={styles.thumb} />
                      )}
                    </Pressable>
                    <View style={styles.itemBody}>
                      <AppText weight="medium" numberOfLines={2} style={styles.itemName}>
                        {item.productNameAr || item.productName}
                      </AppText>
                      {item.variantAttributes.length > 0 && (
                        <View style={styles.chips}>
                          {item.variantAttributes.map((a, i) => (
                            <View key={i} style={styles.chip}>
                              <AppText style={styles.chipLabel}>{a.attributeNameAr || a.attributeName}:</AppText>
                              <AppText weight="medium" style={styles.chipValue}>
                                {a.valueAr || a.value}
                              </AppText>
                            </View>
                          ))}
                        </View>
                      )}
                      {!item.isAvailable && <AppText style={styles.closed}>غير متوفر</AppText>}
                      <View style={styles.priceRow}>
                        <AppText weight="bold" style={styles.price}>
                          {formatPrice(item.price, item.weightStepKg)}
                        </AppText>
                        {hasOriginal && (
                          <AppText style={styles.original}>
                            {Math.round(pricePerKg(item.originalPrice as number, item.weightStepKg)).toLocaleString('en-US')}
                          </AppText>
                        )}
                      </View>

                      <View style={styles.itemFoot}>
                        <View style={styles.stepper}>
                          <Pressable
                            style={styles.stepBtn}
                            disabled={busy || atMax}
                            onPress={() => updateQuantity(item, item.quantity + 1)}
                            accessibilityLabel="زيادة الكمية"
                          >
                            <Ionicons name="add" size={16} color={busy || atMax ? colors.placeholder : tc('#374151')} />
                          </Pressable>
                          <View style={styles.qty}>
                            {busy ? (
                              <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                              <AppText weight="bold" numberOfLines={1} style={styles.qtyText}>
                                {formatQuantity(item.quantity, item.weightStepKg)}
                              </AppText>
                            )}
                          </View>
                          {item.quantity > 1 ? (
                            <Pressable style={styles.stepBtn} disabled={busy} onPress={() => updateQuantity(item, item.quantity - 1)} accessibilityLabel="إنقاص الكمية">
                              <Ionicons name="remove" size={16} color={tc("#374151")} />
                            </Pressable>
                          ) : (
                            <Pressable style={styles.stepBtn} disabled={busy} onPress={() => removeItem(item)} accessibilityLabel="حذف المنتج">
                              <Ionicons name="trash-outline" size={16} color={colors.error} />
                            </Pressable>
                          )}
                        </View>
                        <AppText weight="bold" numberOfLines={1} style={styles.lineTotal}>
                          {money(lineTotal)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        <Pressable style={styles.continue} onPress={() => router.navigate('/products')}>
          <Ionicons name="bag-handle-outline" size={16} color={colors.primary} />
          <AppText weight="medium" style={styles.continueText}>
            متابعة التسوق
          </AppText>
        </Pressable>

        <View style={styles.summary}>
          <AppText weight="bold" style={styles.summaryTitle}>
            ملخص الطلب
          </AppText>
          <CouponBox coupon={coupon} />

          <View style={styles.rows}>
            <View style={styles.row}>
              <AppText style={styles.rowLabel}>المجموع الفرعي</AppText>
              <AppText style={styles.rowLabel}>{money(subtotal)}</AppText>
            </View>
            <View style={styles.row}>
              <View style={styles.inline}>
                <MaterialCommunityIcons name="truck-delivery-outline" size={15} color={tc("#4B5563")} />
                <AppText style={styles.rowLabel}>رسوم التوصيل</AppText>
              </View>
              <AppText style={styles.rowLabel}>
                {anyByZone ? (fixedFees > 0 ? `${money(fixedFees)} + حسب منطقتك` : 'حسب منطقتك') : money(deliveryFees)}
              </AppText>
            </View>
            {vendors.length > 1 && (
              <View style={styles.vendorFees}>
                {vendors.map((v) => (
                  <View key={v.vendorId} style={styles.row}>
                    <AppText style={styles.subLabel}>• {v.vendorNameAr || v.vendorName}</AppText>
                    <AppText style={styles.subLabel}>{feeText(v)}</AppText>
                  </View>
                ))}
              </View>
            )}
            {coupon.discount > 0 && (
              <View style={styles.row}>
                <AppText style={styles.discountLabel}>خصم الكوبون</AppText>
                <AppText style={styles.discountLabel}>-{money(coupon.discount)}</AppText>
              </View>
            )}
          </View>

          <View style={styles.totalRow}>
            <View>
              <AppText weight="bold" style={styles.totalLabel}>
                الإجمالي
              </AppText>
              {anyByZone && <AppText style={styles.zoneNote}>قبل رسوم توصيل منطقتك</AppText>}
            </View>
            <AppText weight="bold" style={styles.totalValue}>
              {money(total)}
            </AppText>
          </View>

          {totalSavings > 0 && (
            <View style={styles.savings}>
              <MaterialCommunityIcons name="piggy-bank-outline" size={17} color={tc("#15803D")} />
              <AppText style={styles.savingsText}>
                وفّرت <AppText weight="bold" style={styles.savingsText}>{money(totalSavings)}</AppText> في هذا الطلب
              </AppText>
            </View>
          )}
          {pointsToEarn > 0 && (
            <Pressable style={styles.points} onPress={() => router.push('/loyalty')}>
              <Ionicons name="star" size={16} color={brand.gold} />
              <AppText style={styles.pointsText}>
                ستكسب <AppText weight="bold" style={styles.pointsText}>{pointsToEarn.toLocaleString('en-US')} نقطة تشجيعية</AppText> من هذا الطلب
              </AppText>
            </Pressable>
          )}

          <AppText muted style={styles.secure}>
            🔒 جميع المعاملات آمنة ومشفرة
          </AppText>
        </View>
      </ScrollView>

      <StickyBar>
        <View>
          <AppText muted style={styles.barLabel}>
            الإجمالي
          </AppText>
          <AppText weight="bold" style={styles.barTotal}>
            {money(total)}
          </AppText>
        </View>
        <Pressable style={[styles.barButton, actions.clear.isPending && { opacity: 0.7 }]} onPress={goCheckout}>
          <AppText weight="bold" style={styles.barButtonText}>
            إتمام الطلب
          </AppText>
          <Ionicons name="arrow-back" size={18} color={colors.white} />
        </Pressable>
      </StickyBar>
    </View>
  );
}

const styles = createStyles(() => ({
  page: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: 12, paddingBottom: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22 },
  count: { minWidth: 26, height: 26, paddingHorizontal: 8, borderRadius: 13, backgroundColor: 'rgba(79,70,229,0.1)', alignItems: 'center', justifyContent: 'center' },
  countText: { color: colors.primary, fontSize: 14, lineHeight: 20 },
  clear: { height: 36, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1, borderColor: '#FECACA' },
  clearText: { color: colors.error, fontSize: 14 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FEF08A', backgroundColor: '#FEFCE8' },
  warningText: { flex: 1, color: '#854D0E', fontSize: 14 },
  vendor: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  vendorHead: { padding: 12, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vendorIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(79,70,229,0.1)', alignItems: 'center', justifyContent: 'center' },
  vendorName: { fontSize: 15 },
  vendorMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { fontSize: 12, flexShrink: 1 },
  vendorTotal: { fontSize: 14, flexShrink: 0 },
  minOk: { color: '#15803D', fontSize: 12, flexShrink: 1 },
  minNeed: { color: '#B45309', fontSize: 12 },
  progressTrack: { marginTop: 6, height: 6, borderRadius: 3, backgroundColor: '#FEF3C7', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#FBBF24' },
  closed: { color: colors.errorDark, fontSize: 12, marginTop: 6 },
  item: { flexDirection: 'row', gap: 12, padding: 12 },
  itemDivider: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  thumb: { width: 80, height: 80, borderRadius: 12, backgroundColor: brand.surfaceMuted },
  itemBody: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  chipLabel: { fontSize: 11, color: colors.placeholder },
  chipValue: { fontSize: 11, color: '#4B5563' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8, marginTop: 4 },
  price: { fontSize: 14, color: colors.primary },
  original: { fontSize: 12, color: colors.placeholder, textDecorationLine: 'line-through' },
  itemFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', height: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 18 },
  stepBtn: { width: 36, height: '100%', alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 32, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 14 },
  lineTotal: { fontSize: 14, flexShrink: 0 },
  continue: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  continueText: { color: colors.primary, fontSize: 14 },
  summary: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
  summaryTitle: { fontSize: 16 },
  rows: { gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowLabel: { fontSize: 14, color: '#4B5563' },
  vendorFees: { gap: 4, paddingStart: 16 },
  subLabel: { fontSize: 12, color: colors.textMuted },
  discountLabel: { fontSize: 14, color: '#16A34A' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  totalLabel: { fontSize: 16 },
  zoneNote: { fontSize: 11, color: colors.textMuted },
  totalValue: { fontSize: 18, color: colors.primary },
  savings: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  savingsText: { flex: 1, fontSize: 14, color: '#15803D' },
  points: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  pointsText: { flex: 1, fontSize: 14, color: '#92400E' },
  secure: { fontSize: 12, textAlign: 'center' },
  barLabel: { fontSize: 11, lineHeight: 13 },
  barTotal: { fontSize: 16, marginTop: 2 },
  barButton: { flex: 1, height: 48, borderRadius: 24, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  barButtonText: { color: colors.white, fontSize: 16 },
}));
