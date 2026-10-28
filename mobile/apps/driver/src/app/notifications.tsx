import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDateTime, notificationTarget, type AppNotification } from '@wasit/shared';
import { AppText, colors, createStyles, radius, useTheme } from '@wasit/ui';
import { useNotificationActions, useNotifications } from '../api/useNotifications';
import { Empty } from '../components/kit';

export default function NotificationsScreen() {
  useTheme();
  const { data, isLoading, isError, refetch, isRefetching } = useNotifications();
  const { markRead, markAllRead, deleteRead } = useNotificationActions();
  const list = data?.notifications ?? [];
  const hasRead = list.some((n) => n.isRead);

  const open = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    const target = notificationTarget(n);
    if (target) router.push({ pathname: '/order/[id]', params: { id: target.orderId } });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="رجوع">
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
        </Pressable>
        <AppText weight="extraBold" style={{ fontSize: 20, flex: 1 }}>الإشعارات</AppText>
        {!!data?.unreadCount && (
          <View style={styles.count}>
            <AppText weight="bold" style={{ fontSize: 12, color: colors.white }}>{data.unreadCount} جديد</AppText>
          </View>
        )}
      </View>

      {list.length > 0 && (
        <View style={styles.actions}>
          <Pressable onPress={() => markAllRead.mutate()} disabled={!data?.unreadCount} hitSlop={8} style={styles.action}>
            <Ionicons name="checkmark-done" size={16} color={data?.unreadCount ? colors.primary : colors.placeholder} />
            <AppText weight="medium" style={{ fontSize: 13, color: data?.unreadCount ? colors.primary : colors.placeholder }}>تعليم الكل كمقروء</AppText>
          </Pressable>
          <Pressable onPress={() => deleteRead.mutate()} disabled={!hasRead} hitSlop={8} style={styles.action}>
            <Ionicons name="trash-outline" size={16} color={hasRead ? colors.error : colors.placeholder} />
            <AppText weight="medium" style={{ fontSize: 13, color: hasRead ? colors.error : colors.placeholder }}>حذف المقروءة</AppText>
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : isError ? (
        <View style={styles.center}>
          <Empty icon="cloud-offline-outline" text="تعذّر تحميل الإشعارات" />
          <Pressable onPress={() => refetch()} style={styles.retry} accessibilityRole="button">
            <AppText weight="bold" style={{ color: colors.white }}>إعادة المحاولة</AppText>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} />}>
          {list.length === 0 && <Empty icon="notifications-outline" text="لا توجد إشعارات بعد" />}
          {list.map((n) => (
            <Pressable key={n.id} onPress={() => open(n)} style={({ pressed }) => [styles.card, !n.isRead && styles.unread, pressed && { opacity: 0.85 }]}>
              <View style={[styles.icon, !n.isRead && { backgroundColor: colors.primary }]}>
                <Ionicons name={notificationTarget(n) ? 'cube-outline' : 'notifications-outline'} size={18} color={n.isRead ? colors.textMuted : colors.white} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText weight={n.isRead ? 'regular' : 'bold'} style={{ fontSize: 14.5, lineHeight: 22 }}>{n.message}</AppText>
                <AppText muted style={{ fontSize: 12 }}>{formatDateTime(n.createdAt)}</AppText>
              </View>
              {notificationTarget(n) && <Ionicons name="chevron-back" size={16} color={colors.placeholder} />}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  count: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  retry: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 10 },
  list: { padding: 16, paddingTop: 4, paddingBottom: 32, gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 12 },
  unread: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
}));
