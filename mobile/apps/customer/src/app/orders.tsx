import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { countPieces, getImageUrl, IMG_SIZE, isActiveOrder, OrderStatus, orderStatusAr, reorderLines, useSessionStore, type OrderDetails, formatDate, formatClock } from '@wasit/shared';
import { AppText, Button, brand, colors, createStyles, createThemed, spacing, tc, useTheme } from '@wasit/ui';
import { useOrders } from '../api/useOrders';
import { AppHeader } from '../components/AppHeader';
import { toast, toastReorderResult } from '../lib/toast';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type GroupKey = 'active' | 'delivered' | 'cancelled' | 'all';

const PAGE_SIZE = 10;

const GROUPS: { key: GroupKey; label: string; match: (status: string) => boolean }[] = [
  { key: 'active', label: 'الحالية', match: isActiveOrder },
  { key: 'delivered', label: 'المكتملة', match: (s) => s === OrderStatus.Delivered },
  { key: 'cancelled', label: 'الملغاة', match: (s) => s === OrderStatus.Cancelled || s === OrderStatus.DeliveryFailed },
  { key: 'all', label: 'الكل', match: () => true },
];

const EMPTY_TEXT: Record<GroupKey, string> = {
  active: 'لا توجد طلبات قيد التنفيذ حالياً',
  delivered: 'لم يتم توصيل أي طلب بعد',
  cancelled: 'لا توجد طلبات ملغاة',
  all: 'لم تقم بأي طلب بعد',
};

// مراحل الطلب لشريط التقدم
const PROGRESS_STEPS = [
  { key: 'PENDING_CONFIRMATION', label: 'استلام' },
  { key: 'CONFIRMED', label: 'تأكيد' },
  { key: 'PREPARING', label: 'تحضير' },
  { key: 'READY', label: 'جاهز' },
  { key: 'OUT_FOR_DELIVERY', label: 'في الطريق' },
  { key: 'DELIVERED', label: 'توصيل' },
];

const STATUS_STYLE = createThemed<Record<string, { bg: string; fg: string; icon: IconName }>>(() => ({
  PENDING_CONFIRMATION: { bg: tc('#FEF3C7'), fg: tc('#92400E'), icon: 'time-outline' },
  CONFIRMED: { bg: tc('#DBEAFE'), fg: tc('#1D4ED8'), icon: 'checkmark' },
  PARTIALLY_CONFIRMED: { bg: tc('#DBEAFE'), fg: tc('#1D4ED8'), icon: 'checkmark' },
  PREPARING: { bg: tc('#E0E7FF'), fg: tc('#4338CA'), icon: 'cube-outline' },
  READY: { bg: tc('#CCFBF1'), fg: tc('#0F766E'), icon: 'cube-outline' },
  OUT_FOR_DELIVERY: { bg: tc('#F3E8FF'), fg: tc('#7E22CE'), icon: 'car-outline' },
  DELIVERED: { bg: tc('#DCFCE7'), fg: tc('#15803D'), icon: 'checkmark' },
  CANCELLED: { bg: tc('#FEE2E2'), fg: tc('#DC2626'), icon: 'close' },
  DELIVERY_FAILED: { bg: tc('#FFEDD5'), fg: tc('#9A3412'), icon: 'close' },
}));

const formatOrderDate = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 1) return `اليوم، ${formatClock(iso)}`;
  if (days < 2) return 'أمس';
  return formatDate(iso);
};

function Progress({ status }: { status: string }) {
  useTheme();
  const normalized = status === OrderStatus.PartiallyConfirmed ? OrderStatus.Confirmed : status;
  const current = PROGRESS_STEPS.findIndex((s) => s.key === normalized);
  if (current < 0) return null;
  return (
    <View style={styles.progress}>
      {PROGRESS_STEPS.map((step, i) => (
        <View key={step.key} style={{ flex: 1, minWidth: 0 }}>
          <View style={[styles.bar, i <= current && { backgroundColor: colors.primary }]} />
          <AppText
            numberOfLines={1}
            weight={i === current ? 'bold' : 'regular'}
            style={[styles.stepLabel, i === current ? { color: colors.primary } : i < current ? { color: tc('#4B5563') } : null]}
          >
            {step.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function OrderCard({ order, reordering, onReorder }: { order: OrderDetails; reordering: boolean; onReorder: () => void }) {
  useTheme();
  const status = order.status?.toUpperCase();
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING_CONFIRMATION;
  const items = order.subOrders.flatMap((s) => s.items);
  const shown = items.slice(0, 3);
  const more = items.length - shown.length;
  const vendors = [...new Set(order.subOrders.map((s) => s.vendorNameAr || s.vendorName).filter(Boolean))];
  const active = isActiveOrder(status);
  const first = items[0]?.productNameAr || items[0]?.productName;
  const open = (track?: boolean) =>
    router.push({ pathname: '/order/[id]', params: track ? { id: order.id, track: '1' } : { id: order.id } });

  return (
    <View style={styles.card}>
      <Pressable style={styles.cardBody} onPress={() => open()}>
        <View style={styles.cardHead}>
          <View style={[styles.pill, { backgroundColor: style.bg }]}>
            <Ionicons name={style.icon} size={13} color={style.fg} />
            <AppText weight="bold" style={{ color: style.fg, fontSize: 12, lineHeight: 18 }}>
              {orderStatusAr(status)}
            </AppText>
          </View>
          <AppText style={styles.date}>{formatOrderDate(order.createdAt)}</AppText>
        </View>

        <View style={styles.itemsRow}>
          <View style={styles.thumbs}>
            {shown.map((item, i) => {
              const image = getImageUrl(item.productImageUrl, IMG_SIZE.THUMB);
              return (
                <View key={item.id || i} style={[styles.thumb, i > 0 && { marginStart: -12 }]}>
                  {image && <Image source={{ uri: image }} style={styles.thumbImage} contentFit="cover" />}
                  {i === shown.length - 1 && more > 0 && (
                    <View style={styles.more}>
                      <AppText weight="bold" style={styles.moreText}>
                        +{more}
                      </AppText>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText weight="medium" numberOfLines={1} style={styles.first}>
              {first}
            </AppText>
            {items.length > 1 && (
              <AppText muted style={styles.meta}>
                + {items.length - 1} {items.length - 1 === 1 ? 'منتج آخر' : 'منتجات أخرى'}
              </AppText>
            )}
            {vendors.length > 0 && (
              <AppText muted numberOfLines={1} style={styles.meta}>
                من {vendors.join('، ')}
              </AppText>
            )}
            <AppText style={styles.number}>طلب #{order.orderNumber}</AppText>
          </View>
          <Ionicons name="chevron-back" size={18} color={tc("#D1D5DB")} />
        </View>

        {active && (
          <View style={{ marginTop: 16 }}>
            <Progress status={status} />
          </View>
        )}
        {status === OrderStatus.Cancelled && !!order.cancellationReason && (
          <AppText numberOfLines={2} style={styles.cancelReason}>
            سبب الإلغاء: {order.cancellationReason}
          </AppText>
        )}
      </Pressable>

      <View style={styles.footer}>
        <View>
          <AppText muted style={styles.count}>
            {countPieces(items)} قطعة
          </AppText>
          <AppText weight="bold" style={styles.total}>
            {Math.round(order.totalAmount || 0).toLocaleString('en-US')} د.ع
          </AppText>
        </View>
        <View style={styles.actions}>
          {active ? (
            <Pressable style={styles.trackBtn} onPress={() => open(true)}>
              <Ionicons name="location-outline" size={15} color={colors.white} />
              <AppText weight="bold" style={styles.trackText}>
                تتبع الطلب
              </AppText>
            </Pressable>
          ) : (
            <>
              {status === OrderStatus.Delivered && (
                <Pressable style={styles.rateBtn} onPress={() => open()}>
                  <Ionicons name="star-outline" size={15} color={tc("#F59E0B")} />
                  <AppText weight="medium" style={styles.rateText}>
                    قيّم
                  </AppText>
                </Pressable>
              )}
              <Pressable style={[styles.reorderBtn, reordering && { opacity: 0.6 }]} disabled={reordering} onPress={onReorder}>
                {reordering ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="refresh" size={15} color={colors.white} />}
                <AppText weight="bold" style={styles.trackText}>
                  إعادة الطلب
                </AppText>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  useTheme();
  const signedIn = useSessionStore((s) => s.signedIn);
  const queryClient = useQueryClient();
  const { data, error, isLoading, isError, refetch, isFetching } = useOrders();
  const [picked, setPicked] = useState<GroupKey | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const all = useMemo(() => data ?? [], [data]);

  // العودة إلى الشاشة (من تفاصيل طلب أو غيرها) تجلب آخر الحالات، فلا يبقى «قيد التوصيل» وهو سُلِّم
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else refetch();
    }, [refetch]),
  );

  const counts = useMemo(
    () => Object.fromEntries(GROUPS.map((g) => [g.key, all.filter((o) => g.match(o.status?.toUpperCase())).length])) as Record<GroupKey, number>,
    [all],
  );
  // الافتراضي: الطلبات الحالية إن وُجدت، وإلا الكل
  const group: GroupKey = picked ?? (counts.active > 0 ? 'active' : 'all');
  const filtered = useMemo(() => all.filter((o) => GROUPS.find((g) => g.key === group)!.match(o.status?.toUpperCase())), [all, group]);

  const reorder = async (order: OrderDetails) => {
    const lines = order.subOrders.flatMap((sub) =>
      sub.items
        .map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity - i.unavailableQuantity - i.refusedQuantity,
          name: i.productNameAr || i.productName,
        }))
        .filter((l) => l.quantity > 0),
    );
    if (lines.length === 0) {
      toast.error('افتح الطلب وأعد المحاولة', { title: 'تعذّر قراءة منتجات هذا الطلب' });
      return;
    }
    setReorderingId(order.id);
    try {
      const result = await reorderLines(lines);
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      toastReorderResult(result.added, lines.length, result.failed);
    } finally {
      setReorderingId(null);
    }
  };

  if (!signedIn) {
    return (
      <View style={styles.page}>
        <AppHeader back />
        <View style={styles.center}>
          <AppText weight="bold">سجّل دخولك لعرض طلباتك</AppText>
          <Button title="تسجيل الدخول" onPress={() => router.push('/login')} style={{ marginTop: spacing.md }} />
        </View>
      </View>
    );
  }

  const apiError = error as { status?: number; message?: string } | null;

  return (
    <View style={styles.page}>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titleGroup}>
            <AppText weight="bold" style={styles.title}>
              طلباتي
            </AppText>
            {all.length > 0 && (
              <View style={styles.count2}>
                <AppText weight="medium" style={styles.count2Text}>
                  {all.length}
                </AppText>
              </View>
            )}
          </View>
          <Pressable style={styles.refresh} onPress={() => refetch()} disabled={isFetching} accessibilityLabel="تحديث">
            {isFetching ? <ActivityIndicator size="small" color={tc("#4B5563")} /> : <Ionicons name="refresh" size={17} color={tc("#4B5563")} />}
          </Pressable>
        </View>

        <View style={styles.segment}>
          {GROUPS.map((g) => {
            const on = g.key === group;
            return (
              <Pressable
                key={g.key}
                style={[styles.segItem, on && styles.segOn]}
                onPress={() => {
                  setPicked(g.key);
                  setVisible(PAGE_SIZE);
                }}
              >
                <AppText weight={on ? 'bold' : 'medium'} numberOfLines={1} style={[styles.segText, on && { color: colors.text }]}>
                  {g.label}
                </AppText>
                {counts[g.key] > 0 && g.key !== 'all' && (
                  <View style={[styles.segCount, on && { backgroundColor: colors.primary }]}>
                    <AppText weight="medium" style={[styles.segCountText, on && { color: colors.white }]}>
                      {counts[g.key]}
                    </AppText>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {isError && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
            <AppText style={styles.errorText}>
              {apiError?.status ? `(${apiError.status}) ` : ''}
              {apiError?.message || 'فشل تحميل الطلبات'}
            </AppText>
            <Pressable onPress={() => refetch()} hitSlop={8}>
              <AppText weight="medium" style={{ color: tc('#374151'), fontSize: 14 }}>
                إعادة المحاولة
              </AppText>
            </Pressable>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 48 }} />
        ) : filtered.length === 0 ? (
          !isError && (
            <View style={styles.empty}>
              <View style={styles.emptyCircle}>
                <Ionicons name="cube-outline" size={40} color={colors.placeholder} />
              </View>
              <AppText weight="bold" style={{ fontSize: 18, marginTop: 12 }}>
                لا توجد طلبات
              </AppText>
              <AppText muted style={{ textAlign: 'center', marginTop: 4 }}>
                {EMPTY_TEXT[group]}
              </AppText>
              <Button title="تصفح المنتجات" onPress={() => router.navigate('/products')} style={{ marginTop: spacing.md }} />
            </View>
          )
        ) : (
          <>
            {filtered.slice(0, visible).map((order) => (
              <OrderCard key={order.id} order={order} reordering={reorderingId === order.id} onReorder={() => reorder(order)} />
            ))}
            {filtered.length > visible && (
              <Button title="عرض المزيد" variant="outline" onPress={() => setVisible((v) => v + PAGE_SIZE)} />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = createStyles(() => ({
  page: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { padding: spacing.md, gap: 12, paddingBottom: spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22 },
  count2: { minWidth: 26, height: 26, paddingHorizontal: 8, borderRadius: 13, backgroundColor: 'rgba(79,70,229,0.1)', alignItems: 'center', justifyContent: 'center' },
  count2Text: { color: colors.primary, fontSize: 14, lineHeight: 20 },
  refresh: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: '#F3F4F6', borderRadius: 16 },
  segItem: { flex: 1, height: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  segOn: { backgroundColor: colors.surface, elevation: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  segText: { fontSize: 14, color: colors.textMuted, flexShrink: 1 },
  segCount: { minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  segCountText: { fontSize: 11, lineHeight: 16, color: '#4B5563' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  errorText: { flex: 1, color: '#B91C1C', fontSize: 14 },
  empty: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 32 },
  emptyCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardBody: { padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  date: { fontSize: 12, color: colors.placeholder },
  itemsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbs: { flexDirection: 'row' },
  thumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: brand.surfaceMuted, borderWidth: 2, borderColor: colors.surface },
  thumbImage: { width: '100%', height: '100%' },
  more: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  moreText: { color: colors.white, fontSize: 12, writingDirection: 'ltr' },
  first: { fontSize: 14, color: '#111827' },
  meta: { fontSize: 12, marginTop: 2 },
  number: { fontSize: 12, color: colors.placeholder, marginTop: 2 },
  progress: { flexDirection: 'row', gap: 4 },
  bar: { height: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  stepLabel: { marginTop: 4, fontSize: 10, textAlign: 'center', color: colors.placeholder },
  cancelReason: { marginTop: 12, fontSize: 12, color: '#DC2626', backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  count: { fontSize: 11 },
  total: { fontSize: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trackBtn: { height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackText: { color: colors.white, fontSize: 14 },
  rateBtn: { height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  rateText: { color: '#1F2937', fontSize: 14 },
  reorderBtn: { height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center', gap: 6 },
}));
