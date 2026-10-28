import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatClock, formatDate, newestFirst } from '@wasit/shared';
import { AppText, colors, createStyles, radius, useTheme } from '@wasit/ui';
import { useDriverCash, useDriverOrders, useRefreshDriver } from '../../api/useDriver';
import { Card, ChipFilter, Empty, money, Screen } from '../../components/kit';
import { dayKey, inPeriod, PERIODS, type Period } from '../../lib/period';

type Entry = { orderId: string; orderNumber: string; amount: number; collectedAt: string };

const dayLabel = (iso: string) => {
  const key = dayKey(iso);
  const now = new Date();
  if (key === dayKey(now.toISOString())) return 'اليوم';
  if (key === dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())) return 'أمس';
  return formatDate(iso);
};

const num = (n: number) => Math.round(n).toLocaleString('en-US');

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText weight="extraBold" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 14, color: colors.white, alignSelf: 'stretch', textAlign: 'center' }}>{value}</AppText>
      <AppText style={styles.heroMuted}>{label}</AppText>
    </View>
  );
}

export default function CashScreen() {
  useTheme();
  const cash = useDriverCash();
  // تفاصيل الزبون والمنطقة من سجل الطلبات المنتهية (يحتفظ بها الخادم 7 أيام)
  const history = useDriverOrders(true);
  const refreshAll = useRefreshDriver();
  const [period, setPeriod] = useState<Period>('all');

  const detail = new Map((history.data ?? []).map((o) => [o.orderId, o]));
  const allItems: Entry[] = newestFirst(cash.data?.items ?? [], (i) => i.collectedAt);
  const items = allItems.filter((i) => inPeriod(i.collectedAt, period));
  const total = items.reduce((s, i) => s + i.amount, 0);
  const biggest = items.reduce((m, i) => Math.max(m, i.amount), 0);

  const groups: { key: string; label: string; entries: Entry[] }[] = [];
  for (const i of items) {
    const key = dayKey(i.collectedAt);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.entries.push(i);
    else groups.push({ key, label: dayLabel(i.collectedAt), entries: [i] });
  }

  return (
    <Screen title="النقد" refreshControl={<RefreshControl refreshing={cash.isRefetching} onRefresh={refreshAll} />}>
      <View style={styles.hero}>
        <AppText style={styles.heroMuted}>المستحق عليك للعمليات</AppText>
        <AppText weight="extraBold" style={{ color: colors.white, fontSize: 30 }}>{money(cash.data?.total)}</AppText>
        <AppText style={styles.heroMuted}>من {allItems.length} طلب نقدي</AppText>
        {allItems.length > 0 && (
          <View style={styles.stats}>
            <Stat label={period === 'all' ? 'المجموع' : PERIODS.find((p) => p.value === period)!.label} value={num(total)} />
            <View style={styles.sep} />
            <Stat label="عدد الطلبات" value={String(items.length)} />
            <View style={styles.sep} />
            <Stat label="متوسط الطلب" value={num(items.length ? total / items.length : 0)} />
            <View style={styles.sep} />
            <Stat label="الأكبر" value={num(biggest)} />
          </View>
        )}
      </View>

      <ChipFilter options={PERIODS} value={period} onChange={setPeriod} />

      {allItems.length === 0 && !cash.isLoading ? (
        <Empty icon="cash-outline" text="لا يوجد نقد بعهدتك. سلّمت كل شيء للعمليات" />
      ) : items.length === 0 ? (
        <Empty icon="calendar-outline" text="لا حركات نقد في هذه الفترة" />
      ) : (
        groups.map((g) => (
          <View key={g.key} style={{ gap: 6 }}>
            <View style={styles.dayHead}>
              <AppText weight="bold" style={{ fontSize: 13.5 }}>{g.label} · {g.entries.length}</AppText>
              <AppText weight="bold" style={{ fontSize: 13.5, color: colors.primary }}>{money(g.entries.reduce((s, e) => s + e.amount, 0))}</AppText>
            </View>
            <Card>
              {g.entries.map((i, idx) => {
                const o = detail.get(i.orderId);
                const place = o ? [o.zoneName, o.address].filter(Boolean).join('، ') : '';
                return (
                  <Pressable key={i.orderId} style={[styles.row, idx === g.entries.length - 1 && { borderBottomWidth: 0 }]} onPress={() => router.push({ pathname: '/order/[id]', params: { id: i.orderId } })} accessibilityRole="button" accessibilityLabel={`تفاصيل الطلب ${i.orderNumber}`}>
                    <View style={{ flex: 1, gap: 1 }}>
                      <AppText weight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 14, writingDirection: 'ltr', textAlign: 'right' }}>{i.orderNumber}</AppText>
                      {!!o && <AppText numberOfLines={1} style={{ fontSize: 12.5 }}>{o.customerName}</AppText>}
                      {!!place && <AppText muted numberOfLines={1} style={{ fontSize: 11.5 }}>{place}</AppText>}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 1 }}>
                      <AppText weight="bold" style={{ fontSize: 14 }}>{money(i.amount)}</AppText>
                      {!!o && o.deliveryFee > 0 && <AppText muted style={{ fontSize: 11.5 }}>منها توصيل {money(o.deliveryFee)}</AppText>}
                      <AppText muted style={{ fontSize: 11.5 }}>{formatClock(i.collectedAt)}</AppText>
                    </View>
                    <Ionicons name="chevron-back" size={18} color={colors.placeholder} />
                  </Pressable>
                );
              })}
            </Card>
          </View>
        ))
      )}
      <AppText muted style={{ fontSize: 12.5, lineHeight: 22 }}>
        سلّم هذا المبلغ للعمليات. إن وجدت فرقاً عمّا معك فعلاً أخبرهم قبل التسوية. تفاصيل الزبون تظهر للطلبات المسلّمة آخر 7 أيام.
      </AppText>
    </Screen>
  );
}

const styles = createStyles(() => ({
  hero: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: 16, gap: 4, alignItems: 'center' },
  heroMuted: { color: 'rgba(255,255,255,0.88)', fontSize: 12 },
  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: radius.lg, paddingVertical: 8, paddingHorizontal: 6, marginTop: 8, alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  sep: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.25)' },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
}));
