import { Pressable, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { formatClock, getImageUrl, ORDER_STATUS_LABELS, updateVendorProfile } from '@wasit/shared';
import { AppText, colors, createStyles, useTheme } from '@wasit/ui';
import { Image } from 'expo-image';
import { useDashboard, useOrderCounts, useProfile, useReturnTrips, useSales } from '../../api/useVendor';
import { Card, Chip, IconTile, ListRow, money, Screen, SectionTitle } from '../../components/kit';
import { FadeIn, LiveDot, MiniBars, Pulse, useCountUp } from '../../components/live';
import { toast } from '../../lib/toast';
import { palette } from '../../lib/palette';
import { goOrders } from '../../lib/nav';
import { useVendorSession } from '../../lib/vendor';

// الرئيسية: ما يحتاج قرارك الآن أولاً، ثم أرقام المتجر وآخر الطلبات
export default function HomeScreen() {
  useTheme();
  const { vendorId, can, session } = useVendorSession();
  const queryClient = useQueryClient();
  const dash = useDashboard();
  const profile = useProfile();
  const trips = useReturnTrips();
  const counts = useOrderCounts();
  const week = useSales('week');
  const today = useSales('today');
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

  const byStatus = counts.data?.byStatus ?? {};
  const pending = d?.pendingOrders ?? 0;
  const lowStock = (d?.lowStockProducts ?? 0) + (d?.outOfStockProducts ?? 0);
  const returnsIncoming = (trips.data ?? []).length;
  // أحدث طلب ينتظر القبول: نعرض صاحبه ومبلغه بدل جملة عامة
  const latestPending = (d?.recentOrders ?? []).find((o) => o.status === 'PENDING_CONFIRMATION');
  const revenueToday = useCountUp(d?.revenueToday ?? 0);
  const days = (week.data?.salesByDay ?? []).slice(-7);
  const prevRevenue = week.data?.previousRevenue ?? 0;
  const delta = prevRevenue > 0 ? Math.round((((week.data?.totalRevenue ?? 0) - prevRevenue) / prevRevenue) * 100) : null;
  const hour = new Date().getHours();
  const greeting = `${hour < 12 ? 'صباح الخير' : 'مساء الخير'}${session?.fullName ? `، ${session.fullName.split(' ')[0]}` : ''} 👋`;
  // تنبيهات تحتاج انتباهاً: كل صف يفتح الشاشة المناسبة
  const alerts = [
    can('orders') && returnsIncoming > 0 && { key: 'returns', icon: 'return-down-back-outline' as const, tone: 'primary' as const, title: `${returnsIncoming} مرتجع في طريقه إليك`, subtitle: 'أكّد الاستلام حين يصل مع السائق', onPress: () => goOrders('returns') },
    can('products') && lowStock > 0 && { key: 'stock', icon: 'alert-circle-outline' as const, tone: 'warn' as const, title: `${lowStock} منتج ينفد مخزونه`, subtitle: 'راجع الكميات قبل أن يتوقف البيع', onPress: () => router.push('/products') },
    can('reviews') && (d?.pendingReviews ?? 0) > 0 && { key: 'reviews', icon: 'chatbubble-ellipses-outline' as const, tone: 'warn' as const, title: `${d?.pendingReviews} تقييم بلا رد`, subtitle: 'الرد السريع يزيد ثقة الزبائن', onPress: () => router.push('/reviews') },
  ].filter(Boolean) as { key: string; icon: 'return-down-back-outline'; tone: 'primary'; title: string; subtitle: string; onPress: () => void }[];
  const maxSold = Math.max(1, ...(d?.topProducts ?? []).map((t) => t.totalSold));
  const status = !accepting ? { label: 'الطلبات متوقفة', tone: 'bad' as const } : p?.isOpenNow === false ? { label: 'مغلق حسب أوقات العمل', tone: 'warn' as const } : { label: 'يستقبل الطلبات', tone: 'ok' as const };

  return (
    <Screen
      title={p?.nameAr || d?.vendorName || 'متجري'}
      subtitle={greeting}
      tabs
      refreshing={dash.isRefetching}
      onRefresh={() => {
        dash.refetch();
        profile.refetch();
        trips.refetch();
      }}
    >
      {/* حالة الاستقبال والمبيعات */}
      <FadeIn>
      <LinearGradient colors={[palette.burntDeep, palette.burnt, '#E8893A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.circle} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Chip label={status.label} tone={status.tone} />
          {status.tone === 'ok' && <View style={{ marginStart: -12 }}><LiveDot /></View>}
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
            <AppText weight="extraBold" style={{ color: '#FFFFFF', fontSize: 30, lineHeight: 40 }}>{money(revenueToday)}</AppText>
            {delta != null && (
              <View style={styles.delta}>
                <Ionicons name={delta >= 0 ? 'trending-up' : 'trending-down'} size={14} color="#FFFFFF" />
                <AppText weight="bold" style={{ color: '#FFFFFF', fontSize: 12 }}>{delta >= 0 ? '+' : ''}{delta}% عن الأسبوع الماضي</AppText>
              </View>
            )}
            {days.length > 1 && <View style={{ marginTop: 6, marginBottom: 6 }}><MiniBars days={days} /></View>}
            <AppText style={{ color: palette.cream, fontSize: 13, marginTop: 2 }}>آخر 7 أيام: {money(d?.revenueThisWeek)} · هذا الشهر: {money(d?.revenueThisMonth)}</AppText>
          </View>
        ) : (
          <AppText weight="bold" style={{ color: '#FFFFFF', fontSize: 18 }}>صباح الخير</AppText>
        )}
      </LinearGradient>
      </FadeIn>

      {/* اختصارات سريعة تحت بطاقة المبيعات */}
      <FadeIn delay={90}>
      <View style={styles.quick}>
        {can('products') && <QuickAction icon="add-circle-outline" label="إضافة منتج" onPress={() => router.push({ pathname: '/product/[id]', params: { id: 'new' } })} />}
        {can('marketing') && <QuickAction icon="pricetag-outline" tone="bad" label="كوبون جديد" onPress={() => router.push('/promotions')} />}
        {can('reviews') && <QuickAction icon="star-outline" tone="warn" label="التقييمات" onPress={() => router.push('/reviews')} />}
      </View>
      </FadeIn>

      <SectionTitle>تحتاج قرارك الآن</SectionTitle>
      {can('orders') && (
        <FadeIn delay={180}>
        <Pulse active={pending > 0}>
        <Card tone={pending > 0 ? 'warn' : undefined} onPress={() => goOrders('orders', 'PENDING_CONFIRMATION')}>
          <View style={styles.rowC}>
            <IconTile icon="time-outline" tone={pending > 0 ? 'warn' : 'muted'} />
            <View style={{ flex: 1 }}>
              <AppText weight="extraBold" style={{ fontSize: 16 }}>{pending > 0 ? `${pending} طلب بانتظار قبولك` : 'لا طلبات تنتظر قرارك'}</AppText>
              <AppText muted style={{ fontSize: 12.5 }}>{pending > 0 && latestPending ? `${latestPending.customerName} · ${money(latestPending.subtotal)} · اضغط للرد` : pending > 0 ? 'اضغط للرد قبل انتهاء المهلة' : 'كل شيء تحت السيطرة ✓'}</AppText>
            </View>
            <Ionicons name="chevron-back" size={18} color={colors.placeholder} />
          </View>
        </Card>
        </Pulse>
        </FadeIn>
      )}
      {alerts.length > 0 && (
        <FadeIn delay={230}>
          <Card pad={4}>{alerts.map((a, i) => <ListRow key={a.key} icon={a.icon} tone={a.tone} title={a.title} subtitle={a.subtitle} onPress={a.onPress} last={i === alerts.length - 1} />)}</Card>
        </FadeIn>
      )}

      {/* مسار الطلبات: كل مرحلة بعدّادها، تتلوّن حين فيها طلبات، والضغط يفتح قائمتها */}
      {can('orders') && (
        <>
          <SectionTitle action={{ label: 'كل الطلبات', onPress: () => goOrders('orders', 'all') }}>مسار الطلبات</SectionTitle>
          <FadeIn delay={280}>
            <View style={styles.grid}>
              {PIPELINE.map((st) => <PipelineChip key={st.status} icon={st.icon} tone={st.tone} label={st.label} count={byStatus[st.status] ?? 0} onPress={() => goOrders('orders', st.status)} />)}
            </View>
          </FadeIn>
        </>
      )}

      {showNumbers && (
        <>
          <SectionTitle>أداء المتجر</SectionTitle>
          <FadeIn delay={330}>
            <View style={styles.quick}>
              <Kpi icon="receipt-outline" label="طلبات اليوم" value={String(today.data?.totalOrders ?? 0)} />
              <Kpi icon="cash-outline" tone="ok" label="متوسط الطلب" value={money(today.data?.averageOrderValue)} />
              <Kpi icon="star" tone="warn" label={`تقييم (${d?.totalReviews ?? 0})`} value={d?.averageRating != null ? Number(d.averageRating).toFixed(1) : '—'} />
            </View>
          </FadeIn>
          <AppText muted style={{ fontSize: 12.5, marginHorizontal: 4 }}>{d?.activeProducts ?? 0} منتج ظاهر من {d?.totalProducts ?? 0}</AppText>
        </>
      )}

      {showNumbers && (d?.recentOrders?.length ?? 0) > 0 && can('orders') && (
        <>
          <SectionTitle action={{ label: 'كل الطلبات', onPress: () => goOrders('orders', 'all') }}>آخر الطلبات</SectionTitle>
          <Card pad={4}>
            {d!.recentOrders.map((o, i) => (
              <Pressable key={o.subOrderId} onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.subOrderId } })} style={[styles.recent, i > 0 && { borderTopWidth: 1, borderTopColor: '#F8ECDA' }]}>
                <View style={styles.avatar}><AppText weight="extraBold" style={{ color: palette.burnt, fontSize: 15 }}>{(o.customerName || '؟').trim().slice(0, 1)}</AppText></View>
                <View style={{ flex: 1 }}>
                  <AppText weight="bold" style={{ fontSize: 14.5 }} numberOfLines={1}>{o.customerName}</AppText>
                  <AppText muted style={{ fontSize: 12, writingDirection: 'ltr', textAlign: 'right' }}>{o.subOrderNumber} · {formatClock(o.createdAt)}</AppText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <AppText weight="bold">{money(o.subtotal)}</AppText>
                  <Chip label={ORDER_STATUS_LABELS[o.status] ?? o.status} tone={statusTone(o.status)} />
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
                <View style={[styles.rank, i === 0 && { backgroundColor: palette.burnt }]}>
                  <AppText weight="bold" style={{ fontSize: 12, color: i === 0 ? '#FFFFFF' : colors.textMuted }}>{i + 1}</AppText>
                </View>
                <View style={styles.thumb}>{t.imageUrl ? <Image source={{ uri: getImageUrl(t.imageUrl, 200) ?? undefined }} style={{ flex: 1 }} contentFit="cover" /> : null}</View>
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText weight="bold" style={{ fontSize: 14.5 }} numberOfLines={1}>{t.productNameAr || t.productName}</AppText>
                  <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(8, Math.round((t.totalSold / maxSold) * 100))}%` }]} /></View>
                  <AppText muted style={{ fontSize: 12 }}>بيع {t.totalSold} · {money(t.totalRevenue)}</AppText>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

// مراحل الطلب بالترتيب الذي يمر به الطلب
const PIPELINE = [
  { status: 'PENDING_CONFIRMATION', icon: 'time-outline', tone: 'warn', label: 'بانتظارك' },
  { status: 'CONFIRMED', icon: 'checkmark-circle-outline', tone: 'primary', label: 'مؤكد' },
  { status: 'PREPARING', icon: 'cube-outline', tone: 'primary', label: 'قيد التحضير' },
  { status: 'READY', icon: 'bag-check-outline', tone: 'ok', label: 'جاهز' },
  { status: 'OUT_FOR_DELIVERY', icon: 'bicycle-outline', tone: 'ok', label: 'في الطريق' },
  { status: 'DELIVERED', icon: 'checkmark-done-outline', tone: 'ok', label: 'مكتمل' },
] as const;

const statusTone = (st: string): 'primary' | 'ok' | 'warn' | 'bad' | 'muted' =>
  st === 'PENDING_CONFIRMATION' ? 'warn' : st === 'DELIVERED' || st === 'READY' || st === 'OUT_FOR_DELIVERY' ? 'ok' : st === 'CANCELLED' || st === 'DELIVERY_FAILED' ? 'bad' : 'primary';

function PipelineChip({ icon, tone, label, count, onPress }: { icon: React.ComponentProps<typeof IconTile>['icon']; tone: 'primary' | 'ok' | 'warn'; label: string; count: number; onPress: () => void }) {
  useTheme();
  const on = count > 0;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.pipe, !on && { opacity: 0.55 }, pressed && { opacity: 0.8 }]}>
      <IconTile icon={icon} tone={on ? tone : 'muted'} size={34} />
      <AppText weight="extraBold" style={{ fontSize: 20, lineHeight: 26, color: on ? colors.text : colors.textMuted }}>{count}</AppText>
      <AppText muted style={{ fontSize: 11.5 }} numberOfLines={1}>{label}</AppText>
    </Pressable>
  );
}

// مؤشر أداء: أيقونة وقيمة كبيرة وتسمية، ثلاثة بعرض متساوٍ
function Kpi({ icon, tone, label, value }: { icon: React.ComponentProps<typeof IconTile>['icon']; tone?: React.ComponentProps<typeof IconTile>['tone']; label: string; value: string }) {
  useTheme();
  return (
    <View style={styles.quickBtn}>
      <IconTile icon={icon} tone={tone} size={34} />
      <AppText weight="extraBold" style={{ fontSize: 16, lineHeight: 22 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</AppText>
      <AppText muted style={{ fontSize: 11.5 }} numberOfLines={1}>{label}</AppText>
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
  delta: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  quick: { flexDirection: 'row', gap: 8 },
  quickBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16, backgroundColor: colors.surface, shadowColor: '#7A4A12', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  hero: { borderRadius: 20, padding: 16, gap: 10, overflow: 'hidden' },
  circle: { position: 'absolute', left: -50, top: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.09)' },
  switchWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 99, paddingStart: 12, paddingEnd: 4 },
  rowC: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  pipe: { width: '32%', alignItems: 'center', gap: 2, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16, backgroundColor: colors.surface, shadowColor: '#7A4A12', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FBE6D0', alignItems: 'center', justifyContent: 'center' },
  rank: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#F8ECDA', alignItems: 'center', justifyContent: 'center' },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: '#F8ECDA', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: palette.burnt },
  thumb: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#F8ECDA', overflow: 'hidden' },
}));
