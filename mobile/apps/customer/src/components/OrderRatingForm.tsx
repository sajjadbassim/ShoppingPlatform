import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createOrderRating,
  fetchOrderRatingStatus,
  rateStoresAndDrivers,
  type ApiError,
  type OrderDetails,
} from '@wasit/shared';
import { AppText, colors, fonts, createStyles, tc, useTheme } from '@wasit/ui';
import { toast } from '../lib/toast';

const STAR_WORDS = ['', 'سيئ', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'];

function Stars({ value, onChange, size }: { value: number; onChange: (n: number) => void; size: number }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n === value ? 0 : n)} hitSlop={4} accessibilityLabel={`${n} نجوم`}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? tc('#FACC15') : tc('#D1D5DB')} />
        </Pressable>
      ))}
    </View>
  );
}

// تقييم الطلب بزر واحد داخل صفحة الطلب (OrderRatingForm في الويب): كل شيء اختياري ويُرسل ما اختاره الزبون فقط
export function OrderRatingForm({ order }: { order: OrderDetails }) {
  useTheme();
  const queryClient = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ['order-rating-status', order.id],
    queryFn: () => fetchOrderRatingStatus(order.id),
  });

  const [delivery, setDelivery] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [packaging, setPackaging] = useState(0);
  const [recommend, setRecommend] = useState(true);
  const [comment, setComment] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [storeStars, setStoreStars] = useState<Record<string, number>>({});
  const [driverStars, setDriverStars] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  if (!status) return null;

  const experienceDone = status.hasRated;
  const delivered = order.subOrders.filter((s) => s.status === 'DELIVERED');
  const pendingStores = delivered.filter((s) => !status.ratedSubOrderIds.includes(s.id));
  const ratedStores = delivered.filter((s) => status.ratedSubOrderIds.includes(s.id));
  // السائق يُقيَّم مرة واحدة حتى لو أوصل من أكثر من متجر
  const drivers = [...new Map(delivered.filter((s) => s.driverId).map((s) => [s.driverId as string, { id: s.driverId as string, name: s.driverName }])).values()];
  const pendingDrivers = drivers.filter((d) => !status.ratedDriverIds.includes(d.id));

  if (experienceDone && pendingStores.length === 0 && pendingDrivers.length === 0) {
    return (
      <View style={styles.thanks}>
        <Ionicons name="checkmark-circle-outline" size={20} color={tc("#22C55E")} />
        <AppText weight="medium" style={styles.thanksText}>
          شكراً! لقد قيّمت هذا الطلب
        </AppText>
      </View>
    );
  }

  const storeRatings = pendingStores.filter((s) => (storeStars[s.id] ?? 0) > 0).map((s) => ({ subOrderId: s.id, vendorRating: storeStars[s.id] }));
  const driverRatings = pendingDrivers.filter((d) => (driverStars[d.id] ?? 0) > 0).map((d) => ({ driverId: d.id, rating: driverStars[d.id] }));
  const rateExperience = !experienceDone && delivery > 0;
  const canSubmit = rateExperience || storeRatings.length > 0 || driverRatings.length > 0;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      // طلب واحد في الحالتين: التجربة تحمل معها المتاجر والسائقين المختارين إن وُجدوا
      if (rateExperience) {
        await createOrderRating(order.id, {
          deliveryRating: delivery,
          speedRating: speed || undefined,
          packagingRating: packaging || undefined,
          wouldRecommend: recommend,
          deliveryComment: comment,
          storeRatings,
          driverRatings,
        });
      } else {
        await rateStoresAndDrivers(order.id, { storeRatings, driverRatings });
      }
      setStoreStars({});
      setDriverStars({});
      queryClient.invalidateQueries({ queryKey: ['order-rating-status', order.id] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-account'] });
      toast.success('شكراً على تقييمك!');
    } catch (e) {
      toast.error((e as ApiError).message || 'فشل إرسال التقييم');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.title}>
        <Ionicons name="star" size={20} color={tc("#FACC15")} />
        <AppText weight="bold" style={styles.titleText}>
          كيف كانت تجربتك؟
        </AppText>
      </View>

      {experienceDone ? (
        <View style={styles.inline}>
          <Ionicons name="checkmark-circle-outline" size={16} color={tc("#15803D")} />
          <AppText style={{ color: tc('#15803D'), fontSize: 14 }}>قيّمت تجربة التوصيل</AppText>
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: 8 }}>
          <AppText muted style={{ fontSize: 14 }}>
            التوصيل
          </AppText>
          <Stars value={delivery} onChange={setDelivery} size={36} />
          <AppText weight="medium" style={{ fontSize: 14, height: 20, color: tc('#374151') }}>
            {STAR_WORDS[delivery]}
          </AppText>

          {delivery > 0 && !showDetails && (
            <Pressable onPress={() => setShowDetails(true)}>
              <AppText weight="medium" style={{ color: colors.primary, fontSize: 14 }}>
                + أضف تفاصيل (اختياري)
              </AppText>
            </Pressable>
          )}
          {delivery > 0 && showDetails && (
            <View style={styles.details}>
              <View style={styles.detailsRow}>
                <View style={{ gap: 4 }}>
                  <AppText muted style={{ fontSize: 14 }}>
                    سرعة التوصيل
                  </AppText>
                  <Stars value={speed} onChange={setSpeed} size={20} />
                </View>
                <View style={{ gap: 4 }}>
                  <AppText muted style={{ fontSize: 14 }}>
                    التغليف
                  </AppText>
                  <Stars value={packaging} onChange={setPackaging} size={20} />
                </View>
              </View>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="ملاحظة عن التوصيل…"
                placeholderTextColor={colors.placeholder}
                multiline
                maxLength={1000}
                style={styles.comment}
              />
              <View style={styles.recommend}>
                <View style={styles.inline}>
                  <Ionicons name="thumbs-up-outline" size={15} color={colors.primary} />
                  <AppText style={{ fontSize: 14, color: tc('#374151'), flexShrink: 1 }}>أنصح بالشراء من هذه المتاجر</AppText>
                </View>
                <Switch value={recommend} onValueChange={setRecommend} trackColor={{ true: colors.primary }} />
              </View>
            </View>
          )}
        </View>
      )}

      {pendingStores.length > 0 && (
        <View style={styles.section}>
          <AppText muted style={{ fontSize: 14 }}>
            {pendingStores.length > 1 ? 'المتاجر' : 'المتجر'}
          </AppText>
          {pendingStores.map((s) => (
            <View key={s.id} style={styles.rateRow}>
              <AppText weight="medium" numberOfLines={1} style={styles.rateName}>
                {s.vendorNameAr || s.vendorName}
              </AppText>
              <Stars value={storeStars[s.id] ?? 0} onChange={(n) => setStoreStars((p) => ({ ...p, [s.id]: n }))} size={22} />
            </View>
          ))}
          {ratedStores.length > 0 && (
            <View style={styles.inline}>
              <Ionicons name="checkmark-circle-outline" size={12} color={tc("#15803D")} />
              <AppText style={{ color: tc('#15803D'), fontSize: 12, flexShrink: 1 }}>
                تم تقييم: {ratedStores.map((s) => s.vendorNameAr || s.vendorName).join('، ')}
              </AppText>
            </View>
          )}
        </View>
      )}

      {pendingDrivers.length > 0 && (
        <View style={styles.section}>
          <AppText muted style={{ fontSize: 14 }}>
            {pendingDrivers.length > 1 ? 'السائقون' : 'السائق'}
          </AppText>
          {pendingDrivers.map((d) => (
            <View key={d.id} style={styles.rateRow}>
              <AppText weight="medium" numberOfLines={1} style={styles.rateName}>
                {d.name || 'السائق'}
              </AppText>
              <Stars value={driverStars[d.id] ?? 0} onChange={(n) => setDriverStars((p) => ({ ...p, [d.id]: n }))} size={22} />
            </View>
          ))}
        </View>
      )}

      <Pressable style={[styles.submit, (!canSubmit || busy) && { opacity: 0.5 }]} disabled={!canSubmit || busy} onPress={submit}>
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <AppText weight="medium" style={styles.submitText}>
            إرسال التقييم
          </AppText>
        )}
      </Pressable>
      {!canSubmit && (
        <AppText muted style={styles.hint}>
          اختر النجوم لما تريد تقييمه فقط
        </AppText>
      )}
    </View>
  );
}

const styles = createStyles(() => ({
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 20 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleText: { fontSize: 18 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thanks: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  thanksText: { color: '#15803D', fontSize: 14 },
  details: { alignSelf: 'stretch', gap: 16, padding: 16, borderRadius: 12, backgroundColor: colors.background },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  comment: { minHeight: 60, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontFamily: fonts.regular, fontSize: 14, textAlign: 'right', textAlignVertical: 'top', backgroundColor: colors.surface },
  recommend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  section: { gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  rateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rateName: { flex: 1, fontSize: 14, color: '#1F2937' },
  submit: { height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: colors.white, fontSize: 16 },
  hint: { fontSize: 12, textAlign: 'center', marginTop: -12 },
}));
