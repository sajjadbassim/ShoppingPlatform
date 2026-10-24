import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  canCheckout,
  computeCheckoutTotals,
  countPieces,
  createOrder,
  formatPrice,
  formatQuantity,
  getImageUrl,
  groupSlotsByDay,
  hasPin,
  IMG_SIZE,
  redeemBase,
  redeemPoints,
  SUBSTITUTION_OPTIONS,
  useCouponStore,
  useSessionStore,
  vendorUsesZones,
  type ApiError,
  type Address,
  type AuthUser,
  type SubstitutionPreference,
} from '@wasit/shared';
import { AppText, Button, brand, colors, fonts, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { emptyCartInMemory, useCart } from '../api/useCart';
import { useAddresses, useDeliveryQuote, useDeliverySlots, useLoyaltyEstimate, useUpdateAddress, useZonesConfig } from '../api/useCheckout';
import { useCoupon } from '../api/useCoupon';
import { AddPhoneModal } from '../components/AddPhoneModal';
import { ZonePicker } from '../components/ZonePicker';
import { AppHeader } from '../components/AppHeader';
import { CouponBox } from '../components/CouponBox';
import { StickyBar } from '../components/StickyBar';
import { toast } from '../lib/toast';

const money = (n: number) => `${Math.round(n).toLocaleString('en-US')} د.ع`;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const STEPS: { num: number; label: string; icon: IconName }[] = [
  { num: 1, label: 'العنوان', icon: 'location-outline' },
  { num: 2, label: 'الدفع', icon: 'card-outline' },
  { num: 3, label: 'التأكيد', icon: 'checkmark' },
];

const addressLine = (a: Address) => [a.city, a.area, a.streetAddress, a.buildingNumber].filter(Boolean).join('، ');

export default function CheckoutScreen() {
  useTheme();
  const [phoneOpen, setPhoneOpen] = useState(false);
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.session) as AuthUser | null;
  const { data: cart, isLoading: cartLoading } = useCart();
  const { data: addresses, isLoading: addressesLoading } = useAddresses();
  const { data: zones } = useZonesConfig();

  const [step, setStep] = useState(1);
  const [pickedAddressId, setPickedAddressId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [substitution, setSubstitution] = useState<SubstitutionPreference>('SIMILAR');
  const [usePoints, setUsePoints] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [placing, setPlacing] = useState(false);
  // يمنع أن تتحول ضغطة مزدوجة على «التالي» إلى تأكيد للطلب
  const stepEnteredAt = useRef(0);
  useEffect(() => {
    stepEnteredAt.current = Date.now();
  }, [step]);

  const hasGrocery = !!cart?.hasGroceryItems;
  const { data: slotsData, isLoading: slotsLoading } = useDeliverySlots(hasGrocery);
  const slotsEnabled = hasGrocery && !!slotsData?.enabled;
  const slotDays = useMemo(() => groupSlotsByDay(slotsData?.slots ?? []), [slotsData]);
  const selectedSlot = slotsData?.slots.find((s) => s.start === slotStart) ?? null;

  // العنوان المختار: ما اختاره المستخدم، وإلا الافتراضي، وإلا الأول
  const selectedAddress =
    addresses?.find((a) => a.id === pickedAddressId) ?? addresses?.find((a) => a.isDefault) ?? addresses?.[0] ?? null;

  // متجر في السلة يتبع المناطق: الرسوم تُحسب من منطقة العنوان لا من رسوم المتجر
  const zonesOn = !!cart && cart.vendorsSummary.some((v) => vendorUsesZones(zones, v.vendorId));
  const { data: quote, isFetching: quoting } = useDeliveryQuote(selectedAddress?.id, zonesOn);
  const updateAddress = useUpdateAddress();

  const subtotal = cart?.subtotal ?? 0;
  const deliveryFees = zonesOn && quote ? quote.total : (cart?.totalDeliveryFees ?? 0);
  const coupon = useCoupon(subtotal);
  const base = redeemBase(subtotal, deliveryFees, coupon.discount);
  const { data: estimate } = useLoyaltyEstimate(base, !!cart && cart.items.length > 0);
  const maxPoints = estimate?.maxRedeemablePoints ?? 0;
  // الرصيد قد ينزل عن الحد الأدنى بعد تغيّر المجموع، فلا يبقى الاستخدام مفعّلاً
  const pointsActive = usePoints && maxPoints > 0;
  const totals = computeCheckoutTotals({
    subtotal,
    deliveryFees,
    couponDiscount: coupon.discount,
    pointsToRedeem: pointsActive ? maxPoints : 0,
    pointValue: estimate?.pointValue ?? 0,
    earnRate: estimate?.earnRate,
  });

  const displayItems = cart?.vendorsSummary.flatMap((v) => v.items) ?? cart?.items ?? [];
  const itemsCount = countPieces(displayItems);

  const nextStep = () => {
    if (step === 1) {
      if (!selectedAddress) {
        toast.warning('أضف عنواناً جديداً أو اختر أحد عناوينك', { title: 'اختر عنوان التوصيل' });
        return;
      }
      if (!hasPin(selectedAddress)) {
        toast.warning('أضف عنواناً جديداً بموقعك ليصل السائق مباشرة', { title: 'العنوان بلا موقع على الخريطة' });
        return;
      }
    }
    if (step === 2 && slotsEnabled && !selectedSlot) {
      toast.warning('اختر موعد توصيل منتجات السوبرماركت', { title: 'اختر موعد التوصيل' });
      return;
    }
    setStep((s) => s + 1);
  };

  const placeOrder = async () => {
    if (placing || Date.now() - stepEnteredAt.current < 700) return;
    if (!user?.phone) {
      setPhoneOpen(true);
      return;
    }
    if (!selectedAddress) return;

    setPlacing(true);
    try {
      const order = await createOrder({
        addressId: selectedAddress.id,
        customerNotes: notes.trim() || undefined,
        couponCode: coupon.applied?.code,
        deliverySlotStart: slotsEnabled ? selectedSlot?.start : undefined,
        substitutionPreference: hasGrocery ? substitution : undefined,
      });

      // صرف النقاط بعد إنشاء الطلب؛ فشله لا يلغي الطلب
      if (pointsActive) {
        try {
          await redeemPoints(order.id, maxPoints);
        } catch {
          toast.warning('تم إنشاء الطلب بلا خصم النقاط، ورصيدك لم يُخصم. المبلغ المطلوب لا يشمل خصم النقاط.', { title: 'تعذّر استخدام نقاطك', duration: 7000 });
        }
      }

      emptyCartInMemory(queryClient);
      queryClient.removeQueries({ queryKey: ['delivery-slots'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      useCouponStore.getState().clear();
      // شاشة النجاح تظهر أعلى تفاصيل الطلب مرة واحدة (كما في الويب ?success=true)
      router.replace({ pathname: '/order/[id]', params: { id: order.id, success: '1' } });
    } catch (e) {
      const message = (e as ApiError).message || 'حاول مرة أخرى';
      if (message.includes('أضف رقم هاتفك')) toast.error(message, { title: 'رقم الهاتف مطلوب' });
      else if (message.includes('موعد التوصيل')) {
        // انتهت الفترة أثناء الدفع: يختار موعداً آخر
        toast.error(message, { title: 'انتهى الموعد' });
        setSlotStart(null);
        queryClient.invalidateQueries({ queryKey: ['delivery-slots'] });
        setStep(2);
      } else toast.error(message, { title: 'تعذّر إتمام الطلب' });
      setPlacing(false);
    }
  };

  if (cartLoading || addressesLoading) {
    return (
      <View style={styles.page}>
        <AppHeader back />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <View style={styles.page}>
        <AppHeader back />
        <View style={styles.center}>
          <AppText weight="bold" style={{ fontSize: 18 }}>
            السلة فارغة
          </AppText>
          <AppText muted style={{ marginTop: 4 }}>
            لا يمكنك إتمام الشراء بدون منتجات في السلة
          </AppText>
          <Button title="تصفح المنتجات" onPress={() => router.replace('/products')} style={{ marginTop: spacing.md }} />
        </View>
      </View>
    );
  }

  const cartReady = canCheckout(cart);
  const primaryLabel = step === 1 ? 'التالي: طريقة الدفع' : step === 2 ? 'التالي: مراجعة الطلب' : 'تأكيد الطلب';
  const primaryDisabled = placing || (step === 3 && !cartReady);

  return (
    <View style={styles.page}>
      <AddPhoneModal visible={phoneOpen} onClose={() => setPhoneOpen(false)}  />
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* الخطوات */}
        <View style={styles.stepsCard}>
          {STEPS.map((s, i) => {
            const done = step > s.num;
            const current = step === s.num;
            return (
              <View key={s.num} style={styles.stepCell}>
                <Pressable disabled={!done} onPress={() => setStep(s.num)} style={styles.stepButton}>
                  <View style={[styles.stepCircle, done && styles.stepDone, current && styles.stepCurrent]}>
                    <Ionicons name={done ? 'checkmark' : s.icon} size={18} color={done || current ? colors.white : colors.placeholder} />
                  </View>
                  <AppText
                    weight={current ? 'bold' : 'regular'}
                    style={[styles.stepLabel, current && { color: colors.text }, done && { color: tc('#15803D') }]}
                  >
                    {s.label}
                  </AppText>
                </Pressable>
                {i < STEPS.length - 1 && <View style={[styles.stepLine, step > s.num && { backgroundColor: tc('#22C55E') }]} />}
              </View>
            );
          })}
        </View>

        {step === 1 && (
          <View style={styles.card}>
            <View style={styles.cardTitle}>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
              <AppText weight="bold" style={styles.cardTitleText}>
                عنوان التوصيل
              </AppText>
            </View>
            <View style={{ gap: 8 }}>
              {addresses?.map((a) => {
                const active = a.id === selectedAddress?.id;
                return (
                  <OptionCard key={a.id} selected={active} onPress={() => setPickedAddressId(a.id)}>
                    <View style={styles.inlineRow}>
                      <AppText weight="bold" style={styles.optionTitle}>
                        {a.label || 'العنوان'}
                      </AppText>
                      {a.isDefault && (
                        <View style={styles.defaultChip}>
                          <AppText style={styles.defaultChipText}>افتراضي</AppText>
                        </View>
                      )}
                    </View>
                    <AppText style={styles.optionDesc}>{addressLine(a)}</AppText>
                    {!!a.phone && <AppText style={[styles.optionDesc, styles.phone]}>{a.phone}</AppText>}
                    {zones?.enabled && !!a.zoneName && (
                      <View style={styles.zoneChip}>
                        <AppText style={styles.zoneChipText}>منطقة التوصيل: {a.zoneName}</AppText>
                      </View>
                    )}
                    {active && !hasPin(a) && (
                      <View style={styles.pinWarn}>
                        <Ionicons name="location-outline" size={18} color={tc("#D97706")} />
                        <AppText style={styles.pinWarnText}>هذا العنوان بدون موقع على الخريطة. أضف عنواناً جديداً بموقعك ليصل السائق إلى بابك مباشرة.</AppText>
                      </View>
                    )}
                  </OptionCard>
                );
              })}
              {zonesOn && !!selectedAddress && !selectedAddress.zoneId && !!zones?.zones?.length && (
                <View style={styles.zoneBox}>
                  <AppText style={styles.zoneBoxText}>اختر منطقة هذا العنوان لحساب رسوم التوصيل بدقة</AppText>
                  <ZonePicker
                    zones={zones.zones}
                    disabled={updateAddress.isPending}
                    onChange={(zoneId) =>
                      updateAddress.mutate(
                        {
                          id: selectedAddress.id,
                          input: {
                            label: selectedAddress.label ?? '',
                            streetAddress: selectedAddress.streetAddress,
                            city: selectedAddress.city,
                            area: selectedAddress.area ?? '',
                            buildingNumber: selectedAddress.buildingNumber ?? '',
                            phone: selectedAddress.phone ?? '',
                            notes: selectedAddress.notes ?? '',
                            isDefault: selectedAddress.isDefault,
                            latitude: selectedAddress.latitude,
                            longitude: selectedAddress.longitude,
                            zoneId,
                          },
                        },
                        { onError: (e) => toast.error((e as ApiError).message || 'تعذّر حفظ المنطقة') },
                      )
                    }
                  />
                </View>
              )}
              <OptionCard selected={false} onPress={() => router.push('/address-new')}>
                <AppText weight="bold" style={[styles.optionTitle, { color: colors.primary }]}>
                  + إضافة عنوان جديد
                </AppText>
              </OptionCard>
            </View>
          </View>
        )}

        {step === 2 && hasGrocery && (
          <View style={styles.card}>
            <View style={styles.cardTitle}>
              <Ionicons name="basket-outline" size={20} color={tc("#059669")} />
              <AppText weight="bold" style={styles.cardTitleText}>
                منتجات السوبرماركت
              </AppText>
            </View>
            {slotsData?.enabled !== false && (
              <>
                <View style={[styles.inlineRow, { marginBottom: 12 }]}>
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <AppText muted style={{ fontSize: 14 }}>
                    اختر موعد التوصيل المناسب لك
                  </AppText>
                </View>
                {slotsLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : slotDays.length === 0 ? (
                  <View style={styles.noSlots}>
                    <AppText style={{ color: tc('#92400E'), fontSize: 14 }}>لا توجد مواعيد متاحة الآن. حاول لاحقاً</AppText>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    {slotDays.map((day) => (
                      <View key={day.label}>
                        <AppText weight="bold" style={styles.dayLabel}>
                          {day.label}
                        </AppText>
                        <View style={styles.slots}>
                          {day.slots.map((s) => {
                            const active = s.start === slotStart;
                            return (
                              <Pressable key={s.start} onPress={() => setSlotStart(s.start)} style={[styles.slot, active && styles.slotActive]}>
                                <AppText weight="medium" style={[styles.slotText, active && { color: tc('#065F46') }]}>
                                  {s.timeLabel}
                                </AppText>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
            <View style={[styles.inlineRow, { marginTop: 20, marginBottom: 8 }]}>
              <Ionicons name="refresh-outline" size={14} color={tc("#1F2937")} />
              <AppText weight="bold" style={{ fontSize: 14, color: tc('#1F2937') }}>
                إذا نفد منتج من طلبك
              </AppText>
            </View>
            <View style={{ gap: 8 }}>
              {SUBSTITUTION_OPTIONS.map((o) => (
                <OptionCard key={o.value} selected={substitution === o.value} onPress={() => setSubstitution(o.value)}>
                  <AppText weight="bold" style={styles.optionTitle}>
                    {o.title}
                  </AppText>
                  <AppText style={styles.optionDesc}>{o.desc}</AppText>
                </OptionCard>
              ))}
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.card}>
            <View style={styles.cardTitle}>
              <Ionicons name="card-outline" size={20} color={colors.primary} />
              <AppText weight="bold" style={styles.cardTitleText}>
                طريقة الدفع
              </AppText>
            </View>
            <View style={{ gap: 8 }}>
              <OptionCard selected onPress={() => undefined}>
                <AppText weight="bold" style={styles.optionTitle}>
                  💵 الدفع عند الاستلام
                </AppText>
                <AppText style={styles.optionDesc}>ادفع نقداً للسائق عند استلام طلبك</AppText>
              </OptionCard>
              {[
                { label: '📱 زين كاش', desc: 'الدفع عبر محفظة زين كاش' },
                { label: '💳 بطاقة ائتمان', desc: 'فيزا أو ماستركارد' },
              ].map((m) => (
                <OptionCard key={m.label} disabled selected={false}>
                  <View style={styles.inlineRow}>
                    <AppText weight="bold" style={styles.optionTitle}>
                      {m.label}
                    </AppText>
                    <View style={styles.soonChip}>
                      <AppText weight="medium" style={styles.soonText}>
                        قريباً
                      </AppText>
                    </View>
                  </View>
                  <AppText style={styles.optionDesc}>{m.desc}</AppText>
                </OptionCard>
              ))}
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.card}>
            <View style={styles.cardTitle}>
              <Ionicons name="checkmark" size={20} color={colors.primary} />
              <AppText weight="bold" style={styles.cardTitleText}>
                مراجعة الطلب
              </AppText>
            </View>
            <View style={{ gap: 12 }}>
              <ReviewBox icon="location-outline" title="عنوان التوصيل" onEdit={() => setStep(1)}>
                {selectedAddress && (
                  <>
                    <AppText weight="medium" style={styles.reviewMain}>
                      {selectedAddress.label || 'العنوان'}
                    </AppText>
                    <AppText style={styles.reviewText}>{addressLine(selectedAddress)}</AppText>
                    {!!selectedAddress.phone && <AppText style={[styles.reviewPhone]}>{selectedAddress.phone}</AppText>}
                  </>
                )}
              </ReviewBox>
              <ReviewBox icon="card-outline" title="طريقة الدفع" onEdit={() => setStep(2)}>
                <AppText style={styles.reviewText}>💵 الدفع عند الاستلام</AppText>
              </ReviewBox>
              {hasGrocery && (
                <ReviewBox icon="basket-outline" title="منتجات السوبرماركت" tint={tc("#ECFDF5")} iconColor={tc("#059669")} onEdit={() => setStep(2)}>
                  {selectedSlot && (
                    <AppText style={styles.reviewText}>
                      الموعد: <AppText weight="bold" style={styles.reviewText}>{selectedSlot.dayLabel} {selectedSlot.timeLabel}</AppText>
                    </AppText>
                  )}
                  <AppText style={styles.reviewText}>إن نفد منتج: {SUBSTITUTION_OPTIONS.find((o) => o.value === substitution)?.title}</AppText>
                </ReviewBox>
              )}
              <ReviewBox icon="car-outline" title="التوصيل المتوقع">
                <AppText style={styles.reviewText}>
                  {hasGrocery ? 'منتجات السوبرماركت في الموعد المختار، وبقية المنتجات خلال 2-3 أيام عمل' : 'خلال 2-3 أيام عمل'}
                </AppText>
              </ReviewBox>
              <View>
                <AppText weight="bold" style={styles.notesLabel}>
                  ملاحظات للطلب (اختياري)
                </AppText>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="مثال: الاتصال قبل الوصول، أقرب نقطة دالة..."
                  placeholderTextColor={colors.placeholder}
                  multiline
                  maxLength={500}
                  style={styles.notes}
                />
              </View>
            </View>
          </View>
        )}

        {/* ملخص الطلب */}
        <View style={styles.card}>
          <Pressable style={styles.summaryHead} onPress={() => setShowItems((o) => !o)}>
            <AppText weight="bold" style={{ fontSize: 16 }}>
              ملخص الطلب <AppText muted style={{ fontSize: 14 }}>({itemsCount} قطعة)</AppText>
            </AppText>
            <Ionicons name={showItems ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </Pressable>

          {showItems && (
            <View style={styles.items}>
              {displayItems.map((item) => {
                const image = getImageUrl(item.productImage, IMG_SIZE.THUMB);
                return (
                  <View key={item.variantId || item.productId} style={styles.itemRow}>
                    {image ? <Image source={{ uri: image }} style={styles.itemThumb} contentFit="cover" /> : <View style={styles.itemThumb} />}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText weight="medium" numberOfLines={1} style={{ fontSize: 14 }}>
                        {item.productNameAr || item.productName}
                      </AppText>
                      {item.variantAttributes.length > 0 && (
                        <AppText muted numberOfLines={1} style={{ fontSize: 12 }}>
                          {item.variantAttributes.map((a) => `${a.attributeNameAr || a.attributeName}: ${a.valueAr || a.value}`).join(' · ')}
                        </AppText>
                      )}
                      <View style={styles.itemMeta}>
                        <AppText muted style={{ fontSize: 12 }}>
                          الكمية: {formatQuantity(item.quantity, item.weightStepKg)}
                        </AppText>
                        <AppText weight="bold" style={{ fontSize: 12 }}>
                          {money(item.subtotal || item.price * item.quantity)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.block}>
            <CouponBox coupon={coupon} compact />
          </View>

          {maxPoints > 0 && (
            <View style={[styles.block, styles.pointsRow]}>
              <View style={styles.pointsIcon}>
                <Ionicons name="star" size={15} color={tc("#F59E0B")} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText weight="medium" style={{ fontSize: 14, color: tc('#1F2937') }}>
                  استخدم نقاطك التشجيعية
                </AppText>
                <AppText muted style={{ fontSize: 12 }}>
                  لديك {(estimate?.currentBalance ?? 0).toLocaleString('en-US')} نقطة
                </AppText>
              </View>
              <Switch value={usePoints} onValueChange={setUsePoints} trackColor={{ true: colors.primary }} />
            </View>
          )}

          <View style={[styles.block, { gap: 8 }]}>
            <SummaryRow label="المجموع الفرعي" value={money(subtotal)} />
            <SummaryRow label={quote?.zoneName && zonesOn ? `رسوم التوصيل (${quote.zoneName})` : 'رسوم التوصيل'} icon="truck-delivery-outline" value={money(deliveryFees)} dim={quoting} />
            {coupon.discount > 0 && <SummaryRow label="خصم الكوبون" icon="tag-outline" value={`-${money(coupon.discount)}`} color={tc("#16A34A")} />}
            {totals.pointsDiscount > 0 && <SummaryRow label="خصم النقاط" icon="star-outline" value={`-${money(totals.pointsDiscount)}`} color={tc("#D97706")} />}
          </View>

          <View style={styles.totalRow}>
            <AppText weight="bold" style={{ fontSize: 16 }}>
              الإجمالي
            </AppText>
            <AppText weight="bold" style={styles.totalValue}>
              {money(totals.total)}
            </AppText>
          </View>

          {totals.pointsToEarn > 0 && (
            <View style={styles.earn}>
              <Ionicons name="star" size={15} color={brand.gold} />
              <AppText style={styles.earnText}>
                ستكسب <AppText weight="bold" style={styles.earnText}>{totals.pointsToEarn.toLocaleString('en-US')} نقطة</AppText> بعد توصيل الطلب
              </AppText>
            </View>
          )}

          <View style={styles.secureRow}>
            <AppText muted style={styles.secure}>🔒 معاملات آمنة</AppText>
            <AppText muted style={styles.secure}>📦 إرجاع خلال 14 يوم</AppText>
          </View>
        </View>

        {step === 3 && !cartReady && (
          <AppText style={styles.problem}>عالج ملاحظات السلة (متجر مغلق أو دون الحد الأدنى أو منتج غير متاح) قبل الإتمام.</AppText>
        )}
      </ScrollView>

      <StickyBar>
        {step > 1 ? (
          <Pressable style={styles.backCircle} onPress={() => setStep(step - 1)} accessibilityLabel="الخطوة السابقة">
            <Ionicons name="chevron-forward" size={20} color={tc("#374151")} />
          </Pressable>
        ) : (
          <View>
            <AppText muted style={styles.barLabel}>
              الإجمالي
            </AppText>
            <AppText weight="bold" style={styles.barTotal}>
              {money(totals.total)}
            </AppText>
          </View>
        )}
        <Pressable
          style={[styles.barButton, primaryDisabled && { opacity: 0.7 }]}
          disabled={primaryDisabled}
          onPress={step === 3 ? placeOrder : nextStep}
        >
          {step === 3 && placing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <AppText weight="bold" style={styles.barButtonText}>
                {primaryLabel}
                {step === 3 ? <AppText style={styles.barButtonText}>  • {money(totals.total)}</AppText> : null}
              </AppText>
              {step < 3 && <Ionicons name="chevron-back" size={18} color={colors.white} />}
            </>
          )}
        </Pressable>
      </StickyBar>
    </View>
  );
}

function OptionCard({ selected, disabled, onPress, children }: { selected: boolean; disabled?: boolean; onPress?: () => void; children: React.ReactNode }) {
  useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.option, selected && styles.optionActive, disabled && { opacity: 0.6 }]}>
      <View style={[styles.radio, selected && { borderColor: colors.primary }]}>{selected && <View style={styles.radioDot} />}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>{children}</View>
    </Pressable>
  );
}

function ReviewBox({
  icon,
  title,
  onEdit,
  tint = tc('#F9FAFB'),
  iconColor = colors.primary,
  children,
}: {
  icon: IconName;
  title: string;
  onEdit?: () => void;
  tint?: string;
  iconColor?: string;
  children: React.ReactNode;
}) {
  useTheme();
  return (
    <View style={[styles.reviewBox, { backgroundColor: tint }]}>
      <View style={styles.reviewHead}>
        <View style={styles.inlineRow}>
          <Ionicons name={icon} size={15} color={iconColor} />
          <AppText weight="bold" style={{ fontSize: 14 }}>
            {title}
          </AppText>
        </View>
        {onEdit && (
          <Pressable onPress={onEdit} hitSlop={8}>
            <AppText weight="medium" style={{ color: colors.primary, fontSize: 14 }}>
              تعديل
            </AppText>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

function SummaryRow({ label, value, icon, color = tc('#4B5563'), dim }: { label: string; value: string; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name']; color?: string; dim?: boolean }) {
  useTheme();
  return (
    <View style={[styles.summaryRow, dim && { opacity: 0.5 }]}>
      <View style={styles.inlineRow}>
        {icon && <MaterialCommunityIcons name={icon} size={15} color={color} />}
        <AppText style={{ fontSize: 14, color }}>{label}</AppText>
      </View>
      <AppText style={{ fontSize: 14, color }}>{value}</AppText>
    </View>
  );
}

const styles = createStyles(() => ({
  page: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { padding: spacing.md, gap: 16, paddingBottom: spacing.lg },
  stepsCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 16 },
  stepCell: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  stepButton: { width: 64, alignItems: 'center', gap: 6 },
  stepCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: '#22C55E' },
  stepCurrent: { backgroundColor: colors.primary, borderWidth: 4, borderColor: 'rgba(79,70,229,0.15)' },
  stepLabel: { fontSize: 12, color: colors.placeholder },
  stepLine: { flex: 1, height: 2, marginTop: 20, borderRadius: 1, backgroundColor: colors.border },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardTitleText: { fontSize: 18 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 16, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  optionActive: { borderColor: colors.primary, backgroundColor: 'rgba(79,70,229,0.05)' },
  radio: { marginTop: 2, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionTitle: { fontSize: 15 },
  optionDesc: { fontSize: 14, color: '#4B5563', textAlign: 'left' },
  phone: { color: colors.textMuted, writingDirection: 'ltr', textAlign: 'right' },
  defaultChip: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  defaultChipText: { color: colors.white, fontSize: 11, lineHeight: 16 },
  zoneBox: { gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  zoneBoxText: { fontSize: 14, color: '#1E3A8A' },
  zoneChip: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  zoneChipText: { fontSize: 11, color: '#4B5563' },
  pinWarn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  pinWarnText: { flex: 1, fontSize: 13, color: '#78350F' },
  noSlots: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  dayLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '48%', height: 44, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  slotActive: { borderColor: '#059669', backgroundColor: '#ECFDF5' },
  slotText: { fontSize: 14, color: '#374151' },
  soonChip: { backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  soonText: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  reviewBox: { borderRadius: 12, padding: 12, gap: 2 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  reviewMain: { fontSize: 14, color: '#1F2937' },
  reviewText: { fontSize: 14, color: '#4B5563' },
  reviewPhone: { fontSize: 14, color: colors.textMuted, writingDirection: 'ltr', textAlign: 'right' },
  notesLabel: { fontSize: 14, color: '#1F2937', marginBottom: 6 },
  notes: { minHeight: 64, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontFamily: fonts.regular, fontSize: 14, textAlign: 'right', textAlignVertical: 'top' },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  items: { gap: 12, marginTop: 12 },
  itemRow: { flexDirection: 'row', gap: 12 },
  itemThumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: brand.surfaceMuted },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  block: { paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointsIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  totalValue: { fontSize: 18, color: colors.primary },
  earn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: '#FFFBEB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  earnText: { flex: 1, fontSize: 14, color: '#92400E' },
  secureRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
  secure: { fontSize: 12 },
  problem: { color: colors.errorDark, fontSize: 13 },
  barLabel: { fontSize: 11, lineHeight: 13 },
  barTotal: { fontSize: 16, marginTop: 2 },
  backCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  barButton: { flex: 1, height: 48, borderRadius: 24, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  barButtonText: { color: colors.white, fontSize: 16 },
}));
