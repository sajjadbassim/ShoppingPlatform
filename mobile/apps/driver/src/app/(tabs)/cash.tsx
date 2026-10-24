import { Pressable, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDateTime, newestFirst } from '@wasit/shared';
import { AppText, colors, createStyles, radius, useTheme } from '@wasit/ui';
import { useDriverCash, useRefreshDriver } from '../../api/useDriver';
import { Card, Empty, money, Screen } from '../../components/kit';

export default function CashScreen() {
  useTheme();
  const cash = useDriverCash();
  const refreshAll = useRefreshDriver();
  const items = newestFirst(cash.data?.items ?? [], (i) => i.collectedAt);

  return (
    <Screen title="النقد" refreshControl={<RefreshControl refreshing={cash.isRefetching} onRefresh={refreshAll} />}>
      <View style={styles.hero}>
        <AppText style={styles.heroMuted}>المستحق عليك للعمليات</AppText>
        <AppText weight="extraBold" style={{ color: colors.white, fontSize: 30 }}>{money(cash.data?.total)}</AppText>
        <AppText style={styles.heroMuted}>من {items.length} طلب نقدي</AppText>
      </View>
      {items.length === 0 && !cash.isLoading ? (
        <Empty icon="cash-outline" text="لا يوجد نقد بعهدتك. سلّمت كل شيء للعمليات" />
      ) : (
        <Card>
          {items.map((i) => (
            <Pressable key={i.orderId} style={styles.row} onPress={() => router.push({ pathname: '/order/[id]', params: { id: i.orderId } })} accessibilityRole="button" accessibilityLabel={`تفاصيل الطلب ${i.orderNumber}`}>
              <View style={{ flex: 1 }}>
                <AppText weight="medium" style={{ writingDirection: 'ltr' }}>{i.orderNumber}</AppText>
                <AppText muted style={{ fontSize: 12 }}>{formatDateTime(i.collectedAt)}</AppText>
              </View>
              <AppText weight="bold">{money(i.amount)}</AppText>
              <Ionicons name="chevron-back" size={18} color={colors.placeholder} />
            </Pressable>
          ))}
        </Card>
      )}
      <AppText muted style={{ fontSize: 12.5, lineHeight: 22 }}>
        سلّم هذا المبلغ للعمليات. إن وجدت فرقاً عمّا معك فعلاً أخبرهم قبل التسوية.
      </AppText>
    </Screen>
  );
}

const styles = createStyles(() => ({
  hero: { backgroundColor: '#1F2937', borderRadius: radius.xl, padding: 16, gap: 4, alignItems: 'center' },
  heroMuted: { color: '#C7CCD6', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
}));
