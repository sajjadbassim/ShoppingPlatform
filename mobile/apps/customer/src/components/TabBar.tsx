import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Tabs } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, brand, colors, createStyles, useTheme } from '@wasit/ui';
import { useCartCount } from '../api/useCart';
import { AccountSheet } from './AccountSheet';
import { SoftPing, Wiggle } from './Motion';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: Record<string, { label: string; icon: IconName; active: IconName }> = {
  index: { label: 'الرئيسية', icon: 'home-outline', active: 'home' },
  categories: { label: 'الفئات', icon: 'grid-outline', active: 'grid' },
  cart: { label: 'السلة', icon: 'bag-handle-outline', active: 'bag-handle' },
  account: { label: 'حسابي', icon: 'person-outline', active: 'person' },
};

// ألوان زر الريلز في الويب: from-fuchsia-600 via-rose-500 to-amber-400 (من أسفل اليسار لأعلى اليمين)
const REELS_GRADIENT = ['#C026D3', '#F43F5E', '#FBBF24'] as const;
const ROSE_500 = '#F43F5E';

// الشريط السفلي كما في BottomNav.jsx: الرئيسية، الفئات، [ريلز بارز يهتز وينبض]، السلة، حسابي (قائمة منبثقة)
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  useTheme();
  const insets = useSafeAreaInsets();
  const cartCount = useCartCount();
  const [sheetOpen, setSheetOpen] = useState(false);
  const current = state.routes[state.index]?.name;

  const renderTab = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return null;
    const tab = TABS[routeName];
    // «حسابي» نشط والقائمة مفتوحة أو في شاشة الحساب، وبقية التبويبات تنطفئ أثناء فتحها
    const focused = routeName === 'account' ? sheetOpen || current === 'account' : !sheetOpen && current === routeName;

    return (
      <Pressable
        key={routeName}
        style={styles.tab}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        onPress={() => {
          if (routeName === 'account') setSheetOpen((o) => !o);
          else if (current !== routeName) navigateToTab(route.key);
        }}
      >
        <View>
          <Ionicons name={focused ? tab.active : tab.icon} size={24} color={focused ? brand.ink : colors.placeholder} />
          {routeName === 'cart' && cartCount > 0 && (
            <View style={styles.badge}>
              <AppText weight="bold" style={styles.badgeText}>
                {cartCount > 99 ? '99+' : cartCount}
              </AppText>
            </View>
          )}
        </View>
        <AppText weight={focused ? 'bold' : 'medium'} style={[styles.label, focused && { color: brand.ink }]}>
          {tab.label}
        </AppText>
      </Pressable>
    );
  };

  // السلة المعبّأة: شريط «إتمام الطلب» الثابت يحلّ مكان الشريط السفلي (كما في الويب)
  if (current === 'cart' && cartCount > 0) return null;

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.row}>
        {renderTab('index')}
        {renderTab('categories')}
        <Pressable style={styles.reelsSlot} onPress={() => router.push('/reels')} accessibilityLabel="ريلز">
          <View style={styles.reelsWrap}>
            <SoftPing style={styles.reelsPing} />
            <LinearGradient colors={REELS_GRADIENT} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.reelsCircle}>
              <Wiggle>
                <MaterialCommunityIcons name="movie-open-outline" size={26} color={colors.white} />
              </Wiggle>
            </LinearGradient>
          </View>
          <AppText weight="bold" style={styles.reelsLabel}>
            ريلز
          </AppText>
        </Pressable>
        {renderTab('cart')}
        {renderTab('account')}
      </View>
      <AccountSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const styles = createStyles(() => ({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
  },
  row: { flexDirection: 'row', alignItems: 'stretch', height: 64 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { fontSize: 11, lineHeight: 13, color: colors.placeholder },
  badge: {
    position: 'absolute',
    top: -6,
    end: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.white, fontSize: 10, lineHeight: 13 },
  reelsSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingBottom: 8 },
  reelsWrap: { marginTop: -28, width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  // النبض خلف الدائرة بنفس حجمها (rose-500)
  reelsPing: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: ROSE_500 },
  reelsCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: ROSE_500,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  reelsLabel: { fontSize: 11, lineHeight: 13, color: ROSE_500 },
}));
