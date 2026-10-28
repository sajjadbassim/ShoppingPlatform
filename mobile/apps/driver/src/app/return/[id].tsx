import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDateTime, type ReturnTrip } from '@wasit/shared';
import { AppText, colors, createStyles, useTheme } from '@wasit/ui';
import { useDriverReturns, useRefreshDriver } from '../../api/useDriver';
import { Card, Chip, Empty, openNavigation, PhoneRow } from '../../components/kit';

const stageOf = (t: ReturnTrip): { label: string; tone: 'warn' | 'primary' | 'ok' } =>
  t.status === 'RECEIVED' ? { label: 'استلمها المتجر', tone: 'ok' }
    : t.status === 'AT_CUSTOMER' ? { label: 'بانتظار أخذها من الزبون', tone: 'warn' }
      : { label: 'معك، بانتظار تأكيد المتجر', tone: 'primary' };

function Step({ label, at, done }: { label: string; at?: string | null; done: boolean }) {
  useTheme();
  return (
    <View style={styles.step}>
      <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={done ? colors.success : colors.placeholder} />
      <View style={{ flex: 1 }}>
        <AppText weight={done ? 'medium' : 'regular'} muted={!done}>{label}</AppText>
        {!!at && <AppText muted style={{ fontSize: 12 }}>{formatDateTime(at)}</AppText>}
      </View>
    </View>
  );
}

// تفاصيل مرتجع: المعرّف رقم المرتجع (أو رقم الرحلة لرفض الباب وتعذّر التسليم). قد يضم رحلة لكل متجر
export default function ReturnScreen() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const open = useDriverReturns();
  const closed = useDriverReturns(true);
  const refreshAll = useRefreshDriver();

  const trips = [...(open.data ?? []), ...(closed.data ?? [])].filter((t) => (t.returnId ?? t.id) === id);
  const first = trips[0];
  const stage = first && stageOf(first);
  const pickedUpAt = trips.map((t) => t.pickedUpAt).find(Boolean);
  const receivedAt = trips.every((t) => t.status === 'RECEIVED') ? trips.map((t) => t.receivedAt).filter(Boolean).sort().pop() : null;
  const withCustomer = !!first?.customerName && first.reason === 'customer_return';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="رجوع">
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
        </Pressable>
        <AppText weight="extraBold" style={{ fontSize: 18, flex: 1 }}>تفاصيل المرتجع</AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={open.isRefetching} onRefresh={refreshAll} />}>
        {!first ? (
          <Empty icon="return-down-back-outline" text={open.isLoading || closed.isLoading ? 'جارٍ التحميل…' : 'المرتجع غير موجود'} />
        ) : (
          <>
            <Card accent={colors.primary}>
              <View style={styles.row}>
                <AppText weight="extraBold" style={{ fontSize: 17, writingDirection: 'ltr' }}>{first.returnNumber ?? first.subOrderNumber}</AppText>
                {stage && <Chip label={stage.label} tone={stage.tone} />}
              </View>
              <AppText muted style={{ fontSize: 13 }}>{first.reasonAr}</AppText>
              <AppText muted style={{ fontSize: 12.5 }}>الطلب: <AppText style={{ fontSize: 12.5, writingDirection: 'ltr' }}>{first.orderNumber}</AppText></AppText>
            </Card>

            {withCustomer && (
              <Card>
                <AppText weight="bold">الزبون</AppText>
                <AppText weight="medium">{first.customerName}</AppText>
                <PhoneRow phone={first.customerPhone} />
                {!!first.customerAddress && (
                  <AppText style={{ fontSize: 13 }} onPress={() => openNavigation({ latitude: first.latitude, longitude: first.longitude, address: first.customerAddress })}>
                    📍 {first.customerAddress}
                  </AppText>
                )}
              </Card>
            )}

            {trips.map((t) => (
              <Card key={t.id}>
                <AppText weight="bold">{t.vendorName}</AppText>
                <PhoneRow phone={t.vendorPhone} />
                {!!t.vendorAddress && <AppText muted style={{ fontSize: 13 }}>{t.vendorAddress}</AppText>}
                <AppText muted style={{ fontSize: 12, writingDirection: 'ltr', textAlign: 'right' }}>{t.subOrderNumber}</AppText>
                <View style={styles.divider} />
                {t.items.map((i, k) => (
                  <View key={k} style={styles.row}>
                    <AppText style={{ flex: 1 }}>{i.productName}</AppText>
                    <AppText weight="bold">{'‎'}×{i.quantity}</AppText>
                  </View>
                ))}
              </Card>
            ))}

            <Card>
              <AppText weight="bold">المراحل</AppText>
              <Step label="أُسند إليك" at={first.createdAt} done />
              <Step label={withCustomer ? 'أخذت القطع من الزبون' : 'القطع معك'} at={pickedUpAt} done={first.status !== 'AT_CUSTOMER'} />
              <Step label="استلمها المتجر" at={receivedAt} done={first.status === 'RECEIVED'} />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  content: { padding: 16, paddingTop: 2, paddingBottom: 40, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  divider: { height: 1, backgroundColor: colors.border },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 },
}));
