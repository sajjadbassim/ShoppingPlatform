import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { getImageUrl, IMG_SIZE, logout, useSessionStore, type AuthUser } from '@wasit/shared';
import { AppText, Button, colors, radius, spacing, createStyles, useTheme } from '@wasit/ui';
import { comingSoonToast } from '../lib/toast';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// soon = موجود في الويب ولم يُبنَ في التطبيق بعد (يُبلَّغ المستخدم عند الضغط)
const ITEMS: { label: string; icon: IconName; href?: Href; soon?: boolean }[] = [
  { label: 'المتاجر', icon: 'storefront-outline', href: '/stores' },
  { label: 'جميع المنتجات', icon: 'cube-outline', href: '/products' },
  { label: 'طلباتي', icon: 'cube-outline', href: '/orders' },
  { label: 'المفضلة', icon: 'heart-outline', href: '/wishlist' },
  { label: 'الملف الشخصي', icon: 'person-outline', href: '/account' },
  { label: 'الإعدادات', icon: 'settings-outline', href: '/settings' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

// قائمة «حسابي» السفلية كما في الويب: بيانات المستخدم ثم روابط سريعة وتسجيل الخروج
export function AccountSheet({ visible, onClose }: Props) {
  useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const user = useSessionStore((s) => s.session) as AuthUser | null;
  const signedIn = useSessionStore((s) => s.signedIn);

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="إغلاق" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.handle} />

        {signedIn ? (
          <>
            <View style={styles.userRow}>
              <View style={styles.avatar}>
                {getImageUrl(user?.avatarUrl, IMG_SIZE.THUMB) ? (
                  <Image source={{ uri: getImageUrl(user?.avatarUrl, IMG_SIZE.THUMB)! }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <AppText weight="extraBold" style={styles.avatarText}>
                    {(user?.fullName || '?').charAt(0)}
                  </AppText>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <AppText weight="extraBold" style={styles.name} numberOfLines={1}>
                  {user?.fullName}
                </AppText>
                <AppText muted style={styles.sub} numberOfLines={1}>
                  {user?.phone || user?.email}
                </AppText>
              </View>
            </View>

            <ScrollView>
              {ITEMS.map((item) => {
                // الصفحة الحالية تُلوَّن بلون العلامة كما في الويب
                const active = !!item.href && pathname === item.href;
                const color = active ? colors.primary : colors.text;
                return (
                  <Pressable
                    key={item.label}
                    style={styles.item}
                    onPress={() => (item.href ? go(item.href) : comingSoonToast())}
                  >
                    <View style={[styles.itemIcon, active && { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name={item.icon} size={22} color={color} />
                    </View>
                    <AppText weight="bold" style={[styles.itemLabel, { color }]}>
                      {item.label}
                    </AppText>
                    <Ionicons name="chevron-back" size={18} color={colors.placeholder} />
                  </Pressable>
                );
              })}
              <Pressable
                style={styles.item}
                onPress={() => {
                  onClose();
                  logout();
                }}
              >
                <View style={styles.itemIcon}>
                  <Ionicons name="log-out-outline" size={22} color={colors.errorDark} />
                </View>
                <AppText weight="bold" style={[styles.itemLabel, { color: colors.errorDark }]}>
                  تسجيل الخروج
                </AppText>
              </Pressable>
            </ScrollView>
          </>
        ) : (
          <View>
            <View style={styles.guestButtons}>
              <Button title="تسجيل الدخول" onPress={() => go('/login')} style={{ flex: 1 }} />
              <Button title="إنشاء حساب" variant="outline" onPress={() => go('/register')} style={{ flex: 1 }} />
            </View>
            <View style={styles.guestDivider} />
            {ITEMS.slice(0, 2).map((item) => (
              <Pressable key={item.label} style={styles.item} onPress={() => go(item.href!)}>
                <View style={styles.itemIcon}>
                  <Ionicons name={item.icon} size={22} color={colors.text} />
                </View>
                <AppText weight="bold" style={styles.itemLabel}>
                  {item.label}
                </AppText>
                <Ionicons name="chevron-back" size={18} color={colors.placeholder} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = createStyles(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderTopStartRadius: 28,
    borderTopEndRadius: 28,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.md },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.primary, fontSize: 22, lineHeight: 32 },
  name: { fontSize: 18 },
  sub: { fontSize: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  itemIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { flex: 1, fontSize: 16 },
  guestButtons: { flexDirection: 'row', gap: spacing.sm },
  guestDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
}));
