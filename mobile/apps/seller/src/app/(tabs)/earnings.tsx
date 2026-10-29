import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { commissionLabel, formatDateTime, type LedgerEntry } from '@wasit/shared';
import { AppText, colors, createStyles, useTheme , tc, createThemed } from '@wasit/ui';
import { useEarnings } from '../../api/useVendor';
import { ActionButton, Card, Empty, FilterPills, IconTile, ltr, money, Screen, SectionTitle } from '../../components/kit';
import { FadeIn } from '../../components/live';
import { palette } from '../../lib/palette';

// الخادم يعيد حتى 500 حركة دفعة واحدة؛ نعرض منها صفحات من 30 حتى لا تثقل الشاشة
const PAGE = 30;
// ألوان تتبع الوضع (تُحسب لكل وضع بدل ثابت عند الاستيراد)
const T = createThemed(() => ({
  green: palette.okText,
  red: palette.badText,
  tone: { SALE: palette.okText, RETURN_COMMISSION: palette.okText, PAYOUT: colors.primaryHover, ADJUSTMENT: palette.warnText } as Record<string, string>,
}));

type Period = 'today' | 'week' | 'month' | 'all';
type Kind = 'all' | 'sales' | 'commission' | 'payout' | 'other';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: '7 أيام' },
  { key: 'month', label: '30 يوماً' },
  { key: 'all', label: 'الكل' },
];
const KINDS: { key: Kind; label: string }[] = [
  { key: 'all', label: 'كل الحركات' },
  { key: 'sales', label: 'مبيعات' },
  { key: 'commission', label: 'عمولات' },
  { key: 'payout', label: 'دفعات' },
  { key: 'other', label: 'خصومات وتسويات' },
];

const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const DAY_LETTER = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

// نوع الحركة ← مجموعتها في الفلتر والملخص
const kindOf = (type: string): Kind => (type === 'SALE' ? 'sales' : type === 'COMMISSION' || type === 'RETURN_COMMISSION' ? 'commission' : type === 'PAYOUT' ? 'payout' : 'other');

const startOf = (period: Period): number => {
  const now = new Date();
  if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (period === 'week') return now.getTime() - 7 * 86400000;
  if (period === 'month') return now.getTime() - 30 * 86400000;
  return 0;
};

const dayKey = (d: Date) => d.toLocaleDateString('en-CA');
const dayLabel = (key: string) => {
  const d = new Date(`${key}T12:00:00`);
  const today = new Date();
  if (key === dayKey(today)) return 'اليوم';
  if (key === dayKey(new Date(today.getTime() - 86400000))) return 'أمس';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
const signed = (n: number) => ltr(`${n >= 0 ? '+' : '−'}${Math.round(Math.abs(n)).toLocaleString('en-US')}`);

// «أرباحي»: رصيد المتجر عند المنصة، وتفصيل كيف تكوّن، وكشف حركاته بفلاتر ومجموع كل يوم
export default function EarningsScreen() {
  useTheme();
  const q = useEarnings();
  const s = q.data?.summary;
  const entries = q.data?.entries ?? [];
  const [period, setPeriod] = useState<Period>('month');
  const [kind, setKind] = useState<Kind>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const inPeriod = useMemo(() => {
    const from = startOf(period);
    return entries.filter((e) => new Date(e.createdAt).getTime() >= from).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [entries, period]);

  // ملخص الفترة المختارة من حركاتها
  const stats = useMemo(() => {
    const sum = (f: (e: LedgerEntry) => boolean) => inPeriod.filter(f).reduce((t, e) => t + e.amount, 0);
    const orders = new Set(inPeriod.filter((e) => e.type === 'SALE' && e.orderNumber).map((e) => e.orderNumber));
    const sales = sum((e) => e.type === 'SALE');
    return { net: sum(() => true), sales, commission: sum((e) => kindOf(e.type) === 'commission'), orders: orders.size, avg: orders.size ? sales / orders.size : 0 };
  }, [inPeriod]);

  // صافي كل يوم لآخر أيام الفترة (الرسم)
  const chartDays = period === 'today' ? 0 : period === 'week' ? 7 : 14;
  const chart = useMemo(() => {
    if (!chartDays) return [];
    const net: Record<string, number> = {};
    for (const e of inPeriod) net[dayKey(new Date(e.createdAt))] = (net[dayKey(new Date(e.createdAt))] ?? 0) + e.amount;
    return Array.from({ length: chartDays }, (_, i) => {
      const d = new Date(Date.now() - (chartDays - 1 - i) * 86400000);
      return { key: dayKey(d), day: d, net: net[dayKey(d)] ?? 0 };
    });
  }, [inPeriod, chartDays]);

  const shown = useMemo(() => inPeriod.filter((e) => kind === 'all' || kindOf(e.type) === kind), [inPeriod, kind]);
  const groups = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>();
    for (const e of shown.slice(0, limit)) {
      const k = dayKey(new Date(e.createdAt));
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.entries()];
  }, [shown, limit]);
  // مجموع كل يوم وعدد حركاته من كل الحركات المطابقة للفلتر (لا ما عُرض منها فقط)
  const dayTotals = useMemo(() => {
    const map = new Map<string, { net: number; count: number }>();
    for (const e of shown) {
      const k = dayKey(new Date(e.createdAt));
      const cur = map.get(k) ?? { net: 0, count: 0 };
      map.set(k, { net: cur.net + e.amount, count: cur.count + 1 });
    }
    return map;
  }, [shown]);
  const byOrder = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>();
    for (const e of entries) if (e.orderNumber) map.set(e.orderNumber, [...(map.get(e.orderNumber) ?? []), e]);
    return map;
  }, [entries]);

  const keptShare = s && s.sales > 0 ? Math.max(0, Math.min(100, (s.balance / s.sales) * 100)) : 0;
  const commissionShare = s && s.sales > 0 ? Math.min(100, (s.commission / s.sales) * 100) : 0;
  const maxAbs = Math.max(1, ...chart.map((c) => Math.abs(c.net)));

  return (
    <Screen title="أرباحي" subtitle={s ? `عمولة المنصة على متجرك: ${commissionLabel(s.commissionRule)}` : undefined} tabs refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {q.isError && <AppText muted style={{ textAlign: 'center', paddingVertical: 30 }}>تعذّر تحميل الأرباح</AppText>}
      {s && (
        <>
          <FadeIn>
            <LinearGradient colors={s.balance >= 0 ? [palette.burntDeep, palette.burnt, palette.amber] : ['#8B2D27', palette.bad]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <View style={styles.circle} />
              <AppText style={{ color: palette.cream, fontSize: 13.5 }}>{s.balance >= 0 ? 'الرصيد المستحق للمتجر' : 'على المتجر للمنصة'}</AppText>
              <AppText weight="extraBold" style={{ color: '#FFFFFF', fontSize: 30, lineHeight: 40 }}>{money(Math.abs(s.balance))}</AppText>
              <AppText style={{ color: palette.cream, fontSize: 12.5 }}>{s.lastPayoutAt ? `آخر دفعة: ${formatDateTime(s.lastPayoutAt)}` : 'لم تُحوَّل لك أي دفعة بعد'}</AppText>
            </LinearGradient>
          </FadeIn>

          {/* كيف وصل الرصيد: المعادلة بالأرقام وبنسبتها من المبيعات */}
          <SectionTitle>كيف تكوّن رصيدك</SectionTitle>
          <FadeIn delay={90}>
            <Card>
              <FormulaRow icon="trending-up" label="المبيعات" value={s.sales} sign="+" color={T.green} />
              <FormulaRow icon="ellipse-outline" label="عمولة المنصة" value={s.commission} sign="−" color={T.red} />
              <FormulaRow icon="remove-circle-outline" label="خصومات ومرتجعات" value={s.deductions} sign="−" color={T.red} />
              <FormulaRow icon="cash-outline" label="دفعات مُحوَّلة" value={s.payouts} sign="−" color={T.red} />
              <View style={styles.divider} />
              <View style={styles.formula}>
                <AppText weight="extraBold" style={{ fontSize: 15, flex: 1 }}>الرصيد المستحق</AppText>
                <AppText weight="extraBold" style={{ fontSize: 17, color: s.balance >= 0 ? T.green : T.red }}>{s.balance < 0 ? '−' : ''}{money(Math.abs(s.balance))}</AppText>
              </View>
              {s.sales > 0 && (
                <View style={{ gap: 6, marginTop: 4 }}>
                  <View style={styles.shareBar}>
                    <View style={{ width: `${keptShare}%`, backgroundColor: T.green }} />
                    <View style={{ width: `${commissionShare}%`, backgroundColor: T.red }} />
                    <View style={{ flex: 1, backgroundColor: tc('#E8D9C2') }} />
                  </View>
                  <AppText muted style={{ fontSize: 12 }}>
                    الأخضر: ما بقي لك ({Math.round(keptShare)}٪ من المبيعات) · الأحمر: عمولة المنصة ({commissionShare.toFixed(1)}٪) · الباقي: خصومات ودفعات
                  </AppText>
                </View>
              )}
            </Card>
          </FadeIn>

          <Card>
            <AppText muted style={{ fontSize: 12.5, lineHeight: 21 }}>
              تُضاف قيمة طلبك عند تسليمه للزبون (دون القطع التي رفضها)، وتُخصم عمولة المنصة وكوبونات متجرك والمرتجعات المعتمدة. الدفعات تسجّلها الإدارة عند تحويل المبلغ لك.
            </AppText>
          </Card>

          <SectionTitle>الفترة</SectionTitle>
          <FilterPills value={period} onChange={(v) => { setPeriod(v); setOpen(null); setLimit(PAGE); }} options={PERIODS.map((p) => ({ key: p.key, label: p.label }))} />

          <View style={styles.tiles}>
            <Tile icon="wallet-outline" tone={stats.net >= 0 ? 'ok' : 'bad'} label="صافي الفترة" value={`${stats.net < 0 ? '−' : ''}${money(Math.abs(stats.net))}`} />
            <Tile icon="receipt-outline" label="طلبات مبيعة" value={String(stats.orders)} />
            <Tile icon="cash-outline" tone="warn" label="متوسط الطلب" value={money(stats.avg)} />
          </View>

          {chart.length > 0 && chart.some((c) => c.net !== 0) && (
            <>
              <SectionTitle>صافي الأرباح اليومي</SectionTitle>
              <Card>
                <View style={styles.chart}>
                  {chart.map((c) => {
                    const h = Math.max(c.net === 0 ? 3 : 6, Math.round((Math.abs(c.net) / maxAbs) * 70));
                    return (
                      <View key={c.key} style={styles.barCol}>
                        <View style={{ height: 72, justifyContent: 'flex-end', width: '100%' }}>
                          <View style={{ height: h, borderRadius: 5, backgroundColor: c.net === 0 ? tc('#EADCC6') : c.net > 0 ? T.green : T.red }} />
                        </View>
                        <AppText muted style={{ fontSize: 10.5 }}>{chartDays === 7 ? DAY_LETTER[c.day.getDay()] : c.day.getDate()}</AppText>
                      </View>
                    );
                  })}
                </View>
              </Card>
            </>
          )}

          <SectionTitle>الحركات</SectionTitle>
          <FilterPills value={kind} onChange={(v) => { setKind(v); setOpen(null); setLimit(PAGE); }} options={KINDS.map((k) => ({ key: k.key, label: k.label }))} />
          {groups.length === 0 ? (
            <Empty icon="wallet-outline" text={entries.length === 0 ? 'لا توجد حركات بعد' : 'لا حركات تطابق هذا الفلتر في هذه الفترة'} />
          ) : (
            groups.map(([key, list]) => {
              const total = dayTotals.get(key) ?? { net: 0, count: list.length };
              const dayNet = total.net;
              return (
                <View key={key} style={{ gap: 6 }}>
                  <View style={styles.dayHead}>
                    <AppText weight="bold" muted style={{ fontSize: 12.5, flex: 1 }}>{dayLabel(key)} · {total.count} حركة</AppText>
                    <AppText weight="bold" style={{ fontSize: 12.5, color: dayNet >= 0 ? T.green : T.red }}>{signed(dayNet)}</AppText>
                  </View>
                  <Card pad={4}>
                    {list.map((e, i) => (
                      <LedgerRow key={e.id} e={e} first={i === 0} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} related={e.orderNumber ? byOrder.get(e.orderNumber) : undefined} />
                    ))}
                  </Card>
                </View>
              );
            })
          )}
          {shown.length > limit && <ActionButton title={`عرض المزيد (${shown.length - limit} حركة متبقية)`} tone="ghost" onPress={() => setLimit((l) => l + PAGE)} />}
        </>
      )}
    </Screen>
  );
}

function FormulaRow({ icon, label, value, sign, color }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: number; sign: '+' | '−'; color: string }) {
  useTheme();
  return (
    <View style={styles.formula}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <AppText style={{ fontSize: 14, flex: 1 }}>{label}</AppText>
      <AppText weight="bold" style={{ fontSize: 14.5, color: value === 0 ? colors.textMuted : color }}>{value === 0 ? '' : sign}{money(value)}</AppText>
    </View>
  );
}

function Tile({ icon, tone, label, value }: { icon: React.ComponentProps<typeof IconTile>['icon']; tone?: React.ComponentProps<typeof IconTile>['tone']; label: string; value: string }) {
  useTheme();
  return (
    <View style={styles.tile}>
      <IconTile icon={icon} tone={tone} size={32} />
      <AppText weight="extraBold" style={{ fontSize: 15, lineHeight: 21 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</AppText>
      <AppText muted style={{ fontSize: 11.5 }} numberOfLines={1}>{label}</AppText>
    </View>
  );
}

// حركة واحدة: الضغط يفتح تفاصيلها (الطلب وصافيه والرصيد بعدها)
function LedgerRow({ e, first, open, onToggle, related }: { e: LedgerEntry; first: boolean; open: boolean; onToggle: () => void; related?: LedgerEntry[] }) {
  useTheme();
  const positive = e.amount >= 0;
  const color = T.tone[e.type] ?? (positive ? T.green : colors.errorDark);
  const orderNet = related?.reduce((t, x) => t + x.amount, 0);
  return (
    <View style={!first && { borderTopWidth: 1, borderTopColor: tc('#F8ECDA') }}>
      <Pressable onPress={onToggle} style={styles.row} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={{ flex: 1, gap: 1 }}>
          <AppText weight="bold" style={{ fontSize: 14.5 }}>{e.typeAr}</AppText>
          <AppText muted style={{ fontSize: 12.5 }} numberOfLines={open ? undefined : 2}>{e.description}{e.reference ? ` · ${e.reference}` : ''}</AppText>
          <AppText muted style={{ fontSize: 11.5 }}>{formatDateTime(e.createdAt)}</AppText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <AppText weight="extraBold" style={{ fontSize: 15, color }}>{signed(e.amount)}</AppText>
          <AppText muted style={{ fontSize: 11.5 }}>{money(e.runningBalance)}</AppText>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.placeholder} />
      </Pressable>
      {open && (
        <View style={styles.detail}>
          <DetailLine label="الرصيد بعد هذه الحركة" value={money(e.runningBalance)} />
          {e.orderNumber && <DetailLine label="رقم الطلب" value={ltr(e.orderNumber)} />}
          {related && related.length > 1 && orderNet != null && (
            <DetailLine label={`صافي هذا الطلب (${related.length} حركات)`} value={`${orderNet < 0 ? '−' : ''}${money(Math.abs(orderNet))}`} />
          )}
          {e.reference ? <DetailLine label="المرجع" value={ltr(e.reference)} /> : null}
          {e.subOrderId && <ActionButton title="فتح الطلب" icon="open-outline" tone="soft" compact onPress={() => router.push({ pathname: '/order/[id]', params: { id: e.subOrderId! } })} />}
        </View>
      )}
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <AppText muted style={{ fontSize: 12.5, flex: 1 }}>{label}</AppText>
      <AppText weight="bold" style={{ fontSize: 12.5 }}>{value}</AppText>
    </View>
  );
}

const styles = createStyles(() => ({
  hero: { borderRadius: 20, padding: 16, gap: 2, overflow: 'hidden' },
  circle: { position: 'absolute', left: -50, top: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.09)' },
  formula: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  divider: { height: 1, backgroundColor: '#F1E3CC', marginVertical: 2 },
  shareBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: tc('#E8D9C2') },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16, backgroundColor: colors.surface, shadowColor: tc('#7A4A12'), shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  detail: { gap: 6, paddingHorizontal: 12, paddingBottom: 12 },
}));
