import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { returnTone, useSessionStore, formatPrice, type ReturnRecord, formatDate } from '@wasit/shared';
import { AppText, Button, colors, createStyles, createThemed, radius, spacing, tc, useTheme } from '@wasit/ui';
import { useMyReturns } from '../api/useFeedback';
import { AppHeader } from '../components/AppHeader';

const TONES = createThemed(() => ({
  info: { bg: colors.primaryLight, fg: colors.primary },
  warning: { bg: tc('#FEF3C7'), fg: tc('#B45309') },
  success: { bg: colors.successLight, fg: tc('#047857') },
  error: { bg: colors.errorLight, fg: colors.errorDark },
}));


const goNew = () => router.push('/return-new');

export default function ReturnsScreen() {
  useTheme();
  const signedIn = useSessionStore((s) => s.signedIn);
  const { data, isLoading, isError, refetch, isRefetching } = useMyReturns();

  if (!signedIn) {
    return (
      <View style={styles.safe}>
        <AppHeader back />
        <View style={styles.center}>
          <AppText weight="bold">سجّل دخولك لعرض طلبات الإرجاع</AppText>
          <Button title="تسجيل الدخول" onPress={() => router.push('/login')} style={{ marginTop: spacing.md }} />
        </View>
      </View>
    );
  }

  const top = (
    <View style={{ gap: spacing.md }}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <AppText weight="extraBold" style={styles.title}>
            طلبات الإرجاع
          </AppText>
          <AppText muted style={{ fontSize: 14 }}>
            تتبع وإدارة طلبات إرجاع منتجاتك
          </AppText>
        </View>
      </View>
      <Pressable onPress={goNew} style={styles.newBtn} accessibilityRole="button">
        <Ionicons name="add" size={18} color={colors.white} />
        <AppText weight="bold" style={{ color: colors.white, fontSize: 14 }}>
          طلب إرجاع جديد
        </AppText>
      </Pressable>
      <View style={styles.policy}>
        <Ionicons name="alert-circle-outline" size={20} color={colors.primary} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <AppText weight="bold" style={{ color: colors.primary, fontSize: 15 }}>
            سياسة الإرجاع
          </AppText>
          <AppText style={{ color: colors.primary, fontSize: 13, lineHeight: 22 }}>
            يمكنك إرجاع المنتجات خلال 14 يوم من تاريخ الاستلام. يجب أن يكون المنتج في حالته الأصلية.
          </AppText>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.safe}>
      <AppHeader back />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <AppText weight="bold">تعذّر تحميل طلبات الإرجاع</AppText>
          <Button title="إعادة المحاولة" onPress={() => refetch()} style={{ marginTop: spacing.md }} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListHeaderComponent={top}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="refresh-outline" size={52} color={colors.placeholder} />
              <AppText weight="bold" style={{ fontSize: 18 }}>
                لا توجد طلبات إرجاع
              </AppText>
              <AppText muted style={{ fontSize: 14 }}>
                لم تقدم أي طلب إرجاع حتى الآن
              </AppText>
              <Pressable onPress={goNew} style={[styles.newBtn, { marginTop: 8, paddingHorizontal: 24 }]}>
                <AppText weight="bold" style={{ color: colors.white, fontSize: 14 }}>
                  تقديم طلب إرجاع
                </AppText>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => <ReturnCard record={item} />}
        />
      )}
    </View>
  );
}

function ReturnCard({ record }: { record: ReturnRecord }) {
  useTheme();
  const tone = TONES[returnTone(record.status)];
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <AppText weight="bold" style={{ fontSize: 15 }}>
          طلب إرجاع #{record.returnNumber}
        </AppText>
        <View style={[styles.badge, { backgroundColor: tone.bg }]}>
          <AppText weight="bold" style={{ color: tone.fg, fontSize: 12 }}>
            {record.statusAr}
          </AppText>
        </View>
      </View>
      <AppText muted style={styles.date}>
        {formatDate(record.createdAt)}
      </AppText>
      <AppText style={styles.small}>
        <AppText weight="bold" style={styles.small}>
          الطلب الأصلي:{' '}
        </AppText>
        #{record.orderNumber}
      </AppText>
      <AppText style={styles.small}>
        <AppText weight="bold" style={styles.small}>
          السبب:{' '}
        </AppText>
        {record.reasonAr}
      </AppText>
      <View style={styles.items}>
        {record.items.map((i) => (
          <View key={`${i.productId}-${i.variantId ?? ''}`} style={styles.itemRow}>
            <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
            <AppText style={{ fontSize: 14, flexShrink: 1 }}>
              {i.productName} <AppText muted style={{ fontSize: 13 }}>×{i.quantity}</AppText>
            </AppText>
          </View>
        ))}
      </View>
      {!!record.rejectionReason && <AppText style={styles.problem}>سبب الرفض: {record.rejectionReason}</AppText>}
      {!!record.pickupStatusAr && <AppText style={styles.small}>استلام القطع: {record.pickupStatusAr}</AppText>}
      {record.refundAmount != null && record.refundAmount > 0 && (
        <AppText weight="bold" style={{ color: colors.success }}>
          مبلغ الاسترداد: {formatPrice(record.refundAmount)}
        </AppText>
      )}
    </View>
  );
}

const styles = createStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.background },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: 26 },
  newBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 18, borderRadius: radius.full, backgroundColor: colors.primary, justifyContent: 'center' },
  policy: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: '#C7D2FE' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 20, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 6 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  date: { fontSize: 12, textAlign: 'left' },
  small: { fontSize: 14 },
  items: { backgroundColor: colors.background, borderRadius: radius.lg, padding: 12, gap: 8, marginTop: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  problem: { color: colors.errorDark, fontSize: 13 },
}));
