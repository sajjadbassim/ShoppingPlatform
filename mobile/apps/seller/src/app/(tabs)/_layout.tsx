import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fetchOwnVendorId, logout, patchSession } from '@wasit/shared';
import { AppText, brand, colors, fonts, useTheme } from '@wasit/ui';
import { useDashboard } from '../../api/useVendor';
import { useVendorSession } from '../../lib/vendor';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, { off: IconName; on: IconName }> = {
  index: { off: 'home-outline', on: 'home' },
  orders: { off: 'receipt-outline', on: 'receipt' },
  products: { off: 'cube-outline', on: 'cube' },
  earnings: { off: 'wallet-outline', on: 'wallet' },
  more: { off: 'ellipsis-horizontal-circle-outline', on: 'ellipsis-horizontal-circle' },
};

// شريط عائم بكبسولة: التبويب النشط يعرض أيقونته واسمه بلون البرتقالي، وغيره أيقونة فقط
function FloatingTabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', start: 16, end: 16, bottom: insets.bottom + 10 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          padding: 7,
          borderRadius: 32,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          elevation: 12,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const { options } = descriptors[route.key];
          // تبويب بلا صلاحية (href: null) لا يظهر
          if ((options as { href?: string | null }).href === null) return null;
          const icon = ICONS[route.name] ?? ICONS.index;
          const badge = options.tabBarBadge;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.title}
              onPress={() => !focused && navigateToTab(route.key)}
              style={{
                flex: focused ? 2.4 : 1,
                height: 46,
                borderRadius: 23,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: focused ? colors.primaryLight : brand.surfaceMuted,
              }}
            >
              <Ionicons name={focused ? icon.on : icon.off} size={20} color={focused ? colors.primary : colors.textMuted} />
              {focused && (
                <AppText weight="bold" numberOfLines={1} style={{ fontSize: 13, color: colors.primary }}>{options.title}</AppText>
              )}
              {!!badge && (
                <View style={{ position: 'absolute', top: 3, end: focused ? 6 : 8, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <AppText weight="bold" style={{ fontSize: 10.5, lineHeight: 15, color: '#FFFFFF', fontFamily: fonts.bold }}>{String(badge)}</AppText>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// خمسة تبويبات ثابتة. الموظف لا يرى تبويباً لا يملك صلاحيته (الخادم يفرضها أيضاً)
export default function TabsLayout() {
  useTheme();
  const { can, vendorId } = useVendorSession();

  // جلسة محفوظة قبل حفظ بيانات المستخدم لا تحمل معرّف المتجر: نستعيده، وإن تعذّر (موظف) نطلب دخولاً جديداً
  useEffect(() => {
    if (vendorId) return;
    fetchOwnVendorId()
      .then((id) => (id ? patchSession({ vendorId: id }) : logout()))
      .catch(() => {});
  }, [vendorId]);
  const { data: dash } = useDashboard();
  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'shift', transitionSpec: { animation: 'timing', config: { duration: 280 } } }} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'الرئيسية' }} />
      <Tabs.Screen name="orders" options={{ title: 'الطلبات', href: can('orders') ? undefined : null, tabBarBadge: dash?.pendingOrders || undefined }} />
      <Tabs.Screen name="products" options={{ title: 'المنتجات', href: can('products') ? undefined : null, tabBarBadge: dash?.lowStockProducts || undefined }} />
      <Tabs.Screen name="earnings" options={{ title: 'الأرباح', href: can('finance') ? undefined : null }} />
      <Tabs.Screen name="more" options={{ title: 'المزيد' }} />
    </Tabs>
  );
}
