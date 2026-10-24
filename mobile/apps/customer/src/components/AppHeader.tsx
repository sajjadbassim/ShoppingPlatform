import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@wasit/shared';
import { AppText, colors, radius, spacing, createStyles, useTheme } from '@wasit/ui';
import { useUnreadCount } from '../api/useNotifications';

interface Props {
  // سهم الرجوع بجانب الشعار (كما في صفحات الويب الداخلية)
  back?: boolean;
}

// الرأس الموحّد: الشعار (وسهم الرجوع) في البداية، والبحث والإشعارات في النهاية
export function AppHeader({ back }: Props) {
  useTheme();
  const insets = useSafeAreaInsets();
  const signedIn = useSessionStore((s) => s.signedIn);
  const unread = useUnreadCount();

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.side}>
        {back && (
          <Pressable onPress={goBack} hitSlop={10} accessibilityLabel="رجوع">
            <Ionicons name="arrow-forward" size={24} color={colors.text} />
          </Pressable>
        )}
        <Pressable onPress={() => router.navigate('/')} accessibilityLabel="الرئيسية" style={styles.logo}>
          <AppText weight="extraBold" style={styles.logoText}>
            و
          </AppText>
        </Pressable>
      </View>
      <View style={styles.side}>
        <Pressable onPress={() => router.push('/search')} hitSlop={10} accessibilityLabel="بحث">
          <Ionicons name="search-outline" size={26} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => router.push(signedIn ? '/notifications' : '/login')}
          hitSlop={10}
          accessibilityLabel="الإشعارات"
        >
          <Ionicons name="notifications-outline" size={26} color={colors.text} />
          {signedIn && unread > 0 && (
            <View style={styles.badge}>
              <AppText weight="bold" style={styles.badgeText}>
                {unread > 9 ? '9+' : unread}
              </AppText>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = createStyles(() => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  side: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 40, height: 40, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.white, fontSize: 24, lineHeight: 34, textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: -6,
    end: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 11, lineHeight: 15 },
}));
