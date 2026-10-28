import { Pressable, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { formatClock, getImageUrl, ORDER_STATUS_LABELS, updateVendorProfile } from '@wasit/shared';
import { AppText, colors, createStyles, useTheme } from '@wasit/ui';
import { Image } from 'expo-image';
import { useDashboard, useOrderCounts, useProfile, useReturnTrips } from '../../api/useVendor';
import { Card, Chip, IconTile, money, Screen, SectionTitle } from '../../components/kit';
import { toast } from '../../lib/toast';
import { palette } from '../../lib/palette';
import { goOrders } from '../../lib/nav';
import { useVendorSession } from '../../lib/vendor';

// الرئيسية: ما يحتاج قرارك الآن أولاً، ثم أرقام المتجر وآخر الطلبات
export default function HomeScreen() {
  useTheme();
  const { vendorId, can } = useVendorSession();
  const queryClient = useQueryClient();
  const dash = useDashboard();
  const profile = useProfile();
  const trips = useReturnTrips();
  const counts = useOrderCounts();
  const d = dash.data;
  const p = profile.data;
  const showNumbers = can('home');
  const accepting = p?.isAcceptingOrders ?? true;

  const toggle = useMutation({
    mutationFn: (value: boolean) => updateVendorProfile(vendorId!, { IsAcceptingOrders: value }),
    onSuccess: (_, value) => {
      queryClient.invalidateQueries({ queryKey: ['v-profile'] });
      toast.success(value ? 'المتجر يستقبل الطلبات' : 'أُوقف استقبال الطلبات');
    },
    onError: (e) => toast.error((e as { message?: string }).message || 'تعذّر التحديث'),
  });

  // «قيد التنفيذ» ليست حالة واحدة: نفتح أول مرحلة فيها طلبات (وإلا أولها)
  const byStatus = counts.data?.byStatus ?? {};
  const activeStatus = ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].find((s) => (byStatus[s] ?? 0) > 0) ?? 'CONFIRMED';
  const pending = d?.pendingOrders ?? 0;
  const lowStock = (d?.lowStockProducts ?? 0) + (d?.outOfStockProducts ?? 0);
  const returnsIncoming = (trips.data ?? []).length;
  const status = !accepting ? { label: 'الطلبات متوقفة', tone: 'bad' as const } : p?.isOpenNow === false ? { label: 'مغلق حسب أوقات العمل', tone: 'warn' as const } : { label: 'يستقبل الطلبات', tone: 'ok' as const };

  return (
    <Screen
      title={p?.nameAr || d?.vendorName || 'متجري'}
      subtitle={p?.openStatus || undefined}
      tabs
      refreshing={dash.isRefetching}
      onRefresh={() => {
        dash.refetch();
        profile.refetch();
        trips.refetch();
      }}
    >
      {/* حالة الاستقبال والمبيعات */}
      <LinearGradient colors={[palette.burntDeep, palette.burnt, '#E8893A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.circle} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Chip label={status.label} tone={status.tone} />
          <View style={{ flex: 1 }} />
          {can('settings') && (
            <View style={styles.switchWrap}>
              <AppText weight="bold" style={{ color: '#FFFFFF', fontSize: 12.5 }}>{accepting ? 'مفتوح' : 'متوقف'}</AppText>
              <Switch value={accepting} onValueChange={(v) => toggle.mutate(v)} disabled={toggle.isPending || !p} trackColor={{ true: '#6FCBA6', false: 'rgba(255,255,255,0.35)' }} thumbColor="#FFFFFF" />
            </View>
          )}
        </View>
        {showNumbers ? (
          <View style={{ gap: 2 }}>
            <AppText style={{ color: palette.cream, fontSize: 13 }}>مبيعات اليوم</AppText>
            <AppText weight="extraBold" style={{ color: '#FFFFFF', fontSize: 30, lineHeight: 40 }}>{money(d?.revenueToday)}</AppText>
            <AppText style={{ color: palette.cream, fontSize: 13 }}>آخر 7 أيام: {money(d?.revenueThisWeek)} · هذا الشهر: {money(d?.revenueThisMonth)}</AppText>
          </View>
        ) : (
          <AppText weight="bold" style={{ color: '#FFFFFF', fontSize: 18 }}>صباح الخير</AppText>
        )}
      </LinearGradient>

      {/* اختصارات سريعة تحت بطاقة المبيعات */}
      <View style={styles.quick}>
        {can('products') && <QuickAction icon="add-circle-outline" label="إضافة منتج" onPress={() => router.push({ pathname: '/product/[id]', params: { id: 'new' } })} />}
        {can('marketing') && <QuickAction icon="pricetag-outline" tone="bad" label="كوبون جديد" onPress={() => router.push('/promotions')} />}
        {can('reviews') && <QuickAction icon="star-outline" tone="warn" label="التقييمات" onPress={() => router.push('/reviews')} />}
      </View>

      <SectionTitle>تحتاج قرارك الآن</SectionTitle>
      {can('orders') && (
        <Card tone={pending > 0 ? 'warn' : undefined} onPress={() => goOrders('orders', 'PENDING_CONFIRMATION')}>
          <View style={styles.rowC}>
            <IconTile icon="time-outline" tone={pending > 0 ? 'warn' : 'muted'} />
            <View style={{ flex: 1 }}>
              <AppText weight="extraBold" style={{ fontSize: 16 }}>{pending > 0 ? `${pending} طلب بانتظار قبولك` : 'لا طلبات تنتظر قرارك'}</AppText>
              <AppText muted style={{ fontSize: 12.5 }}>المهلة قصيرة؛ بعدها يظهر الطلب متأخراً للعمليات</AppText>
            </View>
            <Ionicons name="chevron-back" size={18} color={colors.placeholder} />
          </View>
        </Card>
      )}
      {can('orders') && returnsIncoming > 0 && (
        <Card onPress={() => goOrders('returns')}>
          <View style={styles.rowC}>
            <IconTile icon="return-down-back-outline" tone="primary" />
            <View style={{ flex: 1 }}>
              <AppText weight="extraBold" style={{ fontSize: 16 }}>{returnsIncoming} مرتجع في طريقه إليك</AppText>
              <AppText muted style={{ fontSize: 12.5 }}>أكّد الاستلام حين يصل مع السائق</AppText>
            </View>
            <Ionicons name="chevron-back" size={18} color={colors.placeholder} />
          </View>
        </Card>
      )}

      {showNumbers && (
        <>
          <SectionTitle>أرقام المتجر</SectionTitle>
          <View style={styles.grid}>
            <Stat label="قيد التنفيذ" value={d?.activeOrders ?? 0} onPress={can('orders') ? () => goOrders('orders', activeStatus) : undefined} />
            <Stat label="مكتملة" value={d?.completedOrders ?? 0} tone="ok" onPress={can('orders') ? () => goOrders('orders', 'DELIVERED') : undefined} />
            <Stat label="مخزون ينفد" value={lowStock} tone={lowStock > 0 ? 'warn' : undefined} onPress={can('products') ? () => router.push('/products') : undefined} />
            <Stat label="تقييمات بلا رد" value={d?.pendingReviews ?? 0} tone={(d?.pendingReviews ?? 0) > 0 ? 'warn' : undefined} onPress={can('reviews') ? () => router.push('/reviews') : undefined} />
          </View>
          {d?.averageRating != null && (
            <AppText muted style={{ fontSize: 13, marginHorizontal: 4 }}>
              تقييم المتجر {Number(d.averageRating).toFixed(1)} من {d.totalReviews} تقييم · {d.activeProducts} منتج ظاهر من {d.totalProducts}
            </AppText>
          )}
        </>
      )}

      {showNumbers && (d?.recentOrders?.length ?? 0) > 0 && can('orders') && (
        <>
          <SectionTitle action={{ label: 'كل الطلبات', onPress: () => goOrders('orders', 'all') }}>آخر الطلبات</SectionTitle>
          <Card pad={4}>
            {d!.recentOrders.map((o, i) => (
              <Pressable key={o.subOrderId} onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.subOrderId } })} style={[styles.recent, i > 0 && { borderTopWidth: 1, borderTopColor: '#F8ECDA' }]}>
                <View style={{ flex: 1 }}>
                  <AppText weight="bold" style={{ fontSize: 14.5, writingDirection: 'ltr', textAlign: 'right' }}>{o.subOrderNumber}</AppText>
                  <AppText muted style={{ fontSize: 12.5 }}>{o.customerName} · {formatClock(o.createdAt)}</AppText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <AppText weight="bold">{money(o.subtotal)}</AppText>
                  <AppText muted style={{ fontSize: 11.5 }}>{ORDER_STATUS_LABELS[o.status] ?? o.status}</AppText>
                </View>
              </Pressable>
            ))}
          </Card>
        </>
      )}

      {showNumbers && (d?.topProducts?.length ?? 0) > 0 && (
        <>
          <SectionTitle>الأكثر مبيعاً</SectionTitle>
          <Card pad={4}>
            {d!.topProducts.map((t, i) => (
              <View key={t.productId} style={[styles.recent, i > 0 && { borderTopWidth: 1, borderTopColor: '#F8ECDA' }]}>
                <View style={styles.thumb}>{t.imageUrl ? <Image source={{ uri: getImageUrl(t.imageUrl, 200) ?? undefined }} style={{ flex: 1 }} contentFit="cover" /> : null}</View>
                <View style={{ flex: 1 }}>
                  <AppText weight="bold" style={{ fontSize: 14.5 }} numberOfLines={1}>{t.productNameAr || t.productName}</AppText>
                  <AppText muted style={{ fontSize: 12.5 }}>بيع {t.totalSold} · {money(t.totalRevenue)}</AppText>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, tone, onPress }: { label: string; value: number; tone?: 'ok' | 'warn'; onPress?: () => void }) {
  useTheme();
  const color = tone === 'ok' ? '#2D6B4B' : tone === 'warn' ? palette.warnText : colors.text;
  return (
    <View style={{ width: '48.5%' }}>
      <Card onPress={onPress}>
        <View style={styles.rowC}>
          <AppText muted style={{ fontSize: 12.5, flex: 1 }}>{label}</AppText>
          {onPress && <Ionicons name="chevron-back" size={15} color={colors.placeholder} />}
        </View>
        <AppText weight="extraBold" style={{ fontSize: 24, color, lineHeight: 32 }}>{value}</AppText>
      </Card>
    </View>
  );
}

// زر اختصار: أيقونة فوق الاسم، ثلاثة بعرض متساوٍ في صف واحد
function QuickAction({ icon, label, tone, onPress }: { icon: React.ComponentProps<typeof IconTile>['icon']; label: string; tone?: React.ComponentProps<typeof IconTile>['tone']; onPress: () => void }) {
  useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.8 }]}>
      <IconTile icon={icon} tone={tone} size={40} />
      <AppText weight="bold" style={{ fontSize: 12.5 }} numberOfLines={1}>{label}</AppText>
    </Pressable>
  );
}

const styles = createStyles(() => ({
  quick: { flexDirection: 'row', gap: 8 },
  quickBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16, backgroundColor: colors.surface, shadowColor: '#7A4A12', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  hero: { borderRadius: 20, padding: 16, gap: 10, overflow: 'hidden' },
  circle: { position: 'absolute', left: -50, top: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.09)' },
  switchWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 99, paddingStart: 12, paddingEnd: 4 },
  rowC: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  thumb: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#F8ECDA', overflow: 'hidden' },
}));
