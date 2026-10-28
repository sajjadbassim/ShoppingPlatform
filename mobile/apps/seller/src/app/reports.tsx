import React, { useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { getImageUrl, type SalesPeriod } from '@wasit/shared';
import { AppText, colors, createStyles, fonts, useTheme } from '@wasit/ui';
import { useDashboard, useSales } from '../api/useVendor';
import { Card, Chip, Empty, FilterPills, money, Screen, SectionTitle } from '../components/kit';
import { palette } from '../lib/palette';

const PERIODS: { key: SalesPeriod; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: 'آخر 7 أيام' },
  { key: 'month', label: 'هذا الشهر' },
  { key: 'year', label: 'هذا العام' },
  { key: 'custom', label: 'مخصص' },
];

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

// نسبة التغيير عن الفترة السابقة (بنفس عدد الأيام)
function Delta({ now, before }: { now: number; before: number }) {
  useTheme();
  if (!before) return now > 0 ? <Chip label="جديد" tone="ok" /> : null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return <AppText muted style={{ fontSize: 11.5 }}>بلا تغيير</AppText>;
  return <Chip label={`${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%`} tone={pct > 0 ? 'ok' : 'bad'} />;
}

export default function ReportsScreen() {
  useTheme();
  const [period, setPeriod] = useState<SalesPeriod>('month');
  const [range, setRange] = useState({ from: isoDay(new Date(Date.now() - 29 * 86400000)), to: isoDay(new Date()) });
  const sales = useSales(period, range);
  const dash = useDashboard();
  const chartRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const s = sales.data;
  const d = dash.data;

  const days = (s?.salesByDay ?? []).filter((x) => period === 'year' || (period === 'custom' && (s?.salesByDay?.length ?? 0) > 62) ? x.revenue > 0 : true);
  const max = Math.max(1, ...days.map((x) => x.revenue));
  const rangeInvalid = period === 'custom' && range.from > range.to;

  return (
    <Screen title="التقارير" subtitle="تحليل أداء متجرك" back refreshing={sales.isRefetching} onRefresh={() => { sales.refetch(); dash.refetch(); }}>
      <FilterPills value={period} onChange={setPeriod} options={PERIODS} />
      {period === 'custom' && (
        <Card>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <DateField label="من" value={range.from} onChange={(v) => setRange((r) => ({ ...r, from: v }))} />
            <DateField label="إلى" value={range.to} onChange={(v) => setRange((r) => ({ ...r, to: v }))} />
          </View>
          {rangeInvalid && <AppText style={{ color: colors.errorDark, fontSize: 13 }}>تاريخ البداية بعد النهاية</AppText>}
        </Card>
      )}

      {sales.isLoading ? (
        <AppText muted style={{ textAlign: 'center', paddingVertical: 30 }}>جاري التحميل...</AppText>
      ) : s ? (
        <>
          <View style={styles.grid}>
            <Kpi label="صافي المبيعات" value={money(s.totalRevenue)} delta={<Delta now={s.totalRevenue} before={s.previousRevenue} />} />
            <Kpi label="الطلبات" value={String(s.totalOrders)} delta={<Delta now={s.totalOrders} before={s.previousOrders} />} />
            <Kpi label="متوسط قيمة الطلب" value={money(s.averageOrderValue)} />
            <Kpi label="الطلبات النشطة" value={String(d?.activeOrders ?? 0)} sub={`${d?.completedOrders ?? 0} مكتملة · ${d?.cancelledOrders ?? 0} ملغية`} />
          </View>

          <SectionTitle>المبيعات اليومية</SectionTitle>
          <Card>
            {days.length === 0 || s.totalRevenue === 0 ? (
              <Empty icon="bar-chart-outline" text="لا توجد مبيعات في هذه الفترة" />
            ) : (
              <ScrollView ref={chartRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chart} onContentSizeChange={() => chartRef.current?.scrollToEnd({ animated: false })}>
                {days.map((x) => (
                  <View key={x.date} style={styles.barCol}>
                    <AppText muted style={{ fontSize: 9.5 }}>{x.revenue >= 1000 ? `${Math.round(x.revenue / 1000)}k` : x.revenue}</AppText>
                    <View style={[styles.bar, { height: Math.max(4, (x.revenue / max) * 120), backgroundColor: x.revenue === max ? colors.primary : palette.amber }]} />
                    <AppText muted style={{ fontSize: 10 }}>{String(x.date).slice(8, 10)}</AppText>
                  </View>
                ))}
              </ScrollView>
            )}
          </Card>
        </>
      ) : null}

      {(d?.topProducts?.length ?? 0) > 0 && (
        <>
          <SectionTitle>الأكثر مبيعاً</SectionTitle>
          <Card pad={4}>
            {d!.topProducts.map((t, i) => (
              <View key={t.productId} style={[styles.top, i > 0 && { borderTopWidth: 1, borderTopColor: '#F8ECDA' }]}>
                <View style={styles.rank}><AppText weight="extraBold" style={{ color: colors.primaryHover, fontSize: 13 }}>{i + 1}</AppText></View>
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

function Kpi({ label, value, delta, sub }: { label: string; value: string; delta?: React.ReactNode; sub?: string }) {
  useTheme();
  return (
    <View style={{ width: '48.5%' }}>
      <Card>
        <AppText muted style={{ fontSize: 12.5 }}>{label}</AppText>
        <AppText weight="extraBold" style={{ fontSize: 19, lineHeight: 28 }}>{value}</AppText>
        {delta}
        {!!sub && <AppText muted style={{ fontSize: 11.5 }}>{sub}</AppText>}
      </Card>
    </View>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  useTheme();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <AppText weight="medium" style={{ fontSize: 13 }}>{label} (سنة-شهر-يوم)</AppText>
      <TextInput value={value} onChangeText={onChange} placeholder="2026-10-01" placeholderTextColor={colors.placeholder} keyboardType="numbers-and-punctuation" maxLength={10} style={styles.date} />
    </View>
  );
}

const styles = createStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  chart: { alignItems: 'flex-end', gap: 8, minHeight: 170, paddingTop: 8 },
  barCol: { alignItems: 'center', gap: 4, width: 26 },
  bar: { width: 18, borderRadius: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  rank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEF3E2', alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F8ECDA', overflow: 'hidden' },
  date: { minHeight: 48, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.text, writingDirection: 'ltr' },
}));
