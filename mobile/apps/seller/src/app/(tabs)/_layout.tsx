import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand, colors, fonts, useTheme } from '@wasit/ui';
import { useDashboard } from '../../api/useVendor';
import { useVendorSession } from '../../lib/vendor';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// لون التبويب يأتي من التنقل ويقبله Ionicons كنص
const icon = (name: IconName, active: IconName) =>
  function TabIcon({ focused, color }: { focused: boolean; color: unknown }) {
    return <Ionicons name={focused ? active : name} size={23} color={color as string} />;
  };

// خمسة تبويبات ثابتة. الموظف لا يرى تبويباً لا يملك صلاحيته (الخادم يفرضها أيضاً)
export default function TabsLayout() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { can } = useVendorSession();
  const { data: dash } = useDashboard();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryHover,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11.5 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 4 },
        tabBarActiveBackgroundColor: 'transparent',
        tabBarBadgeStyle: { backgroundColor: colors.primary, color: '#FFFFFF', fontFamily: fonts.bold },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="orders" options={{ title: 'الطلبات', href: can('orders') ? undefined : null, tabBarIcon: icon('receipt-outline', 'receipt'), tabBarBadge: dash?.pendingOrders || undefined }} />
      <Tabs.Screen name="products" options={{ title: 'المنتجات', href: can('products') ? undefined : null, tabBarIcon: icon('cube-outline', 'cube'), tabBarBadge: dash?.lowStockProducts || undefined }} />
      <Tabs.Screen name="earnings" options={{ title: 'الأرباح', href: can('finance') ? undefined : null, tabBarIcon: icon('wallet-outline', 'wallet') }} />
      <Tabs.Screen name="more" options={{ title: 'المزيد', tabBarIcon: icon('ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle') }} />
    </Tabs>
  );
}
