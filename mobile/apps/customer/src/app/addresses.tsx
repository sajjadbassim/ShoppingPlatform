import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { formatAddress, hasPin } from '@wasit/shared';
import { AppText, Button, colors, radius, spacing, createStyles, useTheme } from '@wasit/ui';
import { useAddresses, useDeleteAddress } from '../api/useCheckout';
import { confirmDialog } from '../lib/dialog';

export default function AddressesScreen() {
  useTheme();
  const { data: addresses, isLoading, isError, refetch, isRefetching } = useAddresses();
  const remove = useDeleteAddress();

  const confirmDelete = (id: string) =>
    confirmDialog({
      title: 'حذف العنوان',
      message: 'هل تريد حذف هذا العنوان؟',
      confirmText: 'حذف',
      tone: 'danger',
      onConfirm: () => remove.mutate(id),
    });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="رجوع">
          <AppText weight="bold" style={styles.back}>
            ‹
          </AppText>
        </Pressable>
        <AppText weight="extraBold" style={styles.title}>
          عناويني
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <AppText weight="bold">تعذّر تحميل العناوين</AppText>
          <Button title="إعادة المحاولة" onPress={() => refetch()} style={{ marginTop: spacing.md }} />
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={
            <View style={styles.center}>
              <AppText muted>لا توجد عناوين محفوظة</AppText>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  <AppText weight="bold">{item.label || 'عنوان'}</AppText>
                  {item.isDefault && (
                    <View style={styles.badge}>
                      <AppText weight="bold" style={styles.badgeText}>
                        الافتراضي
                      </AppText>
                    </View>
                  )}
                </View>
                <AppText muted style={styles.small}>
                  {formatAddress(item)}
                </AppText>
                {!!item.phone && (
                  <AppText muted style={styles.small}>
                    {item.phone}
                  </AppText>
                )}
                {!hasPin(item) && <AppText style={styles.problem}>بلا موقع على الخريطة، لن يُقبل للطلب</AppText>}
              </View>
              <Pressable onPress={() => confirmDelete(item.id)} hitSlop={8}>
                <AppText weight="medium" style={styles.problem}>
                  حذف
                </AppText>
              </Pressable>
            </View>
          )}
          ListFooterComponent={<Button title="إضافة عنوان جديد" onPress={() => router.push('/address-new')} style={{ marginTop: spacing.md }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = createStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  back: { fontSize: 32, lineHeight: 34, color: colors.primary, width: 40 },
  title: { fontSize: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  list: { padding: spacing.md, gap: spacing.sm },
  card: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md },
  small: { fontSize: 13 },
  problem: { color: colors.errorDark, fontSize: 13 },
  badge: { backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 1 },
  badgeText: { color: colors.primary, fontSize: 11 },
}));
