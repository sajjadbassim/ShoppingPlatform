import { View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { commissionLabel, formatDateTime, type LedgerEntry } from '@wasit/shared';
import { AppText, colors, createStyles, useTheme } from '@wasit/ui';
import { useEarnings } from '../../api/useVendor';
import { Card, Empty, ltr, money, Screen, SectionTitle } from '../../components/kit';
import { palette } from '../../lib/palette';

const TONE: Record<string, string> = { SALE: '#2D6B4B', RETURN_COMMISSION: '#2D6B4B', PAYOUT: colors.primaryHover, ADJUSTMENT: palette.warnText };

// «أرباحي»: رصيد المتجر عند المنصة وكشف حركاته
export default function EarningsScreen() {
  useTheme();
  const q = useEarnings();
  const s = q.data?.summary;
  const entries = q.data?.entries ?? [];

  const cards = s
    ? [
        { label: 'المبيعات', value: s.sales, icon: 'trending-up' as const },
        { label: 'عمولة المنصة', value: -s.commission, icon: 'ellipse-outline' as const },
        { label: 'خصومات ومرتجعات', value: -s.deductions, icon: 'remove-circle-outline' as const },
        { label: 'دفعات مُحوَّلة', value: -s.payouts, icon: 'cash-outline' as const },
      ]
    : [];

  return (
    <Screen title="أرباحي" subtitle={s ? `عمولة المنصة على متجرك: ${commissionLabel(s.commissionRule)}` : undefined} tabs refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {q.isError && <AppText muted style={{ textAlign: 'center', paddingVertical: 30 }}>تعذّر تحميل الأرباح</AppText>}
      {s && (
        <>
          <LinearGradient colors={s.balance >= 0 ? [palette.burntDeep, palette.burnt, palette.amber] : ['#8B2D27', palette.bad]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.circle} />
            <AppText style={{ color: palette.cream, fontSize: 13.5 }}>{s.balance >= 0 ? 'الرصيد المستحق للمتجر' : 'على المتجر للمنصة'}</AppText>
            <AppText weight="extraBold" style={{ color: '#FFFFFF', fontSize: 38, lineHeight: 50 }}>{money(Math.abs(s.balance))}</AppText>
            {s.lastPayoutAt && <AppText style={{ color: palette.cream, fontSize: 12.5 }}>آخر دفعة: {formatDateTime(s.lastPayoutAt)}</AppText>}
          </LinearGradient>

          <View style={styles.grid}>
            {cards.map((c) => (
              <View key={c.label} style={{ width: '48.5%' }}>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name={c.icon} size={15} color={colors.textMuted} />
                    <AppText muted style={{ fontSize: 12.5 }}>{c.label}</AppText>
                  </View>
                  <AppText weight="extraBold" style={{ fontSize: 17 }}>{c.value < 0 ? '−' : ''}{money(Math.abs(c.value))}</AppText>
                </Card>
              </View>
            ))}
          </View>

          <Card>
            <AppText muted style={{ fontSize: 12.5, lineHeight: 21 }}>
              تُضاف قيمة طلبك عند تسليمه للزبون (دون القطع التي رفضها)، وتُخصم عمولة المنصة وكوبونات متجرك والمرتجعات المعتمدة. الدفعات تسجّلها الإدارة عند تحويل المبلغ لك.
            </AppText>
          </Card>

          <SectionTitle>الحركات</SectionTitle>
          {entries.length === 0 ? (
            <Empty icon="wallet-outline" text="لا توجد حركات بعد" />
          ) : (
            <Card pad={4}>
              {entries.map((e, i) => <LedgerRow key={e.id} e={e} first={i === 0} />)}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function LedgerRow({ e, first }: { e: LedgerEntry; first: boolean }) {
  useTheme();
  const positive = e.amount >= 0;
  const color = TONE[e.type] ?? (positive ? '#2D6B4B' : colors.errorDark);
  const open = e.subOrderId ? () => router.push({ pathname: '/order/[id]', params: { id: e.subOrderId! } }) : undefined;
  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: '#F8ECDA' }]}>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText weight="bold" style={{ fontSize: 14.5 }}>{e.typeAr}</AppText>
        <AppText muted style={{ fontSize: 12.5 }} numberOfLines={2} onPress={open}>{e.description}{e.reference ? ` · ${e.reference}` : ''}</AppText>
        <AppText muted style={{ fontSize: 11.5 }}>{formatDateTime(e.createdAt)}</AppText>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <AppText weight="extraBold" style={{ fontSize: 15, color }}>{ltr(`${positive ? '+' : '−'}${Math.round(Math.abs(e.amount)).toLocaleString('en-US')}`)}</AppText>
        <AppText muted style={{ fontSize: 11.5 }}>{money(e.runningBalance)}</AppText>
      </View>
    </View>
  );
}

const styles = createStyles(() => ({
  hero: { borderRadius: 24, padding: 18, gap: 2, overflow: 'hidden' },
  circle: { position: 'absolute', left: -50, top: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.09)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
}));
