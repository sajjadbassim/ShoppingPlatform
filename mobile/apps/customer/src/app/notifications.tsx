import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { notificationTarget, useSessionStore, type AppNotification } from '@wasit/shared';
import { AppText, Button, colors, radius, spacing, createStyles, useTheme } from '@wasit/ui';
import { useNotificationActions, useNotifications } from '../api/useNotifications';

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('ar-IQ', { timeZone: 'Asia/Baghdad', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function NotificationsScreen() {
  useTheme();
  const signedIn = useSessionStore((s) => s.signedIn);
  const { data, isLoading, isError, refetch, isRefetching } = useNotifications();
  const { markRead, markAllRead, deleteRead } = useNotificationActions();

  const open = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    const target = notificationTarget(n);
    if (target) router.push({ pathname: '/order/[id]', params: { id: target.orderId } });
  };

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="رجوع">
        <AppText weight="bold" style={styles.back}>
          ‹
        </AppText>
      </Pressable>
      <AppText weight="extraBold" style={styles.title}>
        الإشعارات
      </AppText>
      <View style={{ width: 40 }} />
    </View>
  );

  if (!signedIn) {
    return (
      <SafeAreaView style={styles.safe}>
        {header}
        <View style={styles.center}>
          <AppText weight="bold">سجّل دخولك لعرض إشعاراتك</AppText>
          <Button title="تسجيل الدخول" onPress={() => router.push('/login')} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const list = data?.notifications ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      {header}
      {list.length > 0 && (
        <View style={styles.actions}>
          <Pressable onPress={() => markAllRead.mutate()} hitSlop={8} disabled={!data?.unreadCount}>
            <AppText weight="medium" style={[styles.action, !data?.unreadCount && { color: colors.placeholder }]}>
              تعليم الكل كمقروء
            </AppText>
          </Pressable>
          <Pressable onPress={() => deleteRead.mutate()} hitSlop={8}>
            <AppText weight="medium" style={[styles.action, { color: colors.errorDark }]}>
              حذف المقروءة
            </AppText>
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <AppText weight="bold">تعذّر تحميل الإشعارات</AppText>
          <Button title="إعادة المحاولة" onPress={() => refetch()} style={{ marginTop: spacing.md }} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={
            <View style={styles.center}>
              <AppText muted>لا توجد إشعارات</AppText>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item)} style={[styles.card, !item.isRead && styles.unread]}>
              {!item.isRead && <View style={styles.dot} />}
              <View style={{ flex: 1, gap: 2 }}>
                <AppText weight={item.isRead ? 'regular' : 'bold'} style={styles.message}>
                  {item.message}
                </AppText>
                <AppText muted style={styles.small}>
                  {formatTime(item.createdAt)}
                </AppText>
              </View>
            </Pressable>
          )}
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
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  action: { color: colors.primary, fontSize: 14 },
  list: { padding: spacing.md, gap: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md },
  unread: { backgroundColor: colors.primaryLight },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
  message: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 12 },
}));
