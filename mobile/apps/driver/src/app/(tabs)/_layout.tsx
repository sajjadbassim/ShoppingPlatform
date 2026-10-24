import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, useTheme } from '@wasit/ui';
import { useDriverProfile } from '../../api/useDriver';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// لون التبويب يأتي من التنقل ويقبله Ionicons كنص
const icon = (name: IconName, active: IconName) =>
  function TabIcon({ focused, color }: { focused: boolean; color: unknown }) {
    return <Ionicons name={focused ? active : name} size={24} color={color as string} />;
  };

export default function TabsLayout() {
  useTheme();
  const { data: me } = useDriverProfile();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'الطلبات', tabBarIcon: icon('cube-outline', 'cube'), tabBarBadge: me?.activeOrders || undefined }} />
      <Tabs.Screen name="returns" options={{ title: 'المرتجعات', tabBarIcon: icon('return-down-back-outline', 'return-down-back'), tabBarBadge: me?.openReturnTrips || undefined }} />
      <Tabs.Screen name="cash" options={{ title: 'النقد', tabBarIcon: icon('cash-outline', 'cash') }} />
      <Tabs.Screen name="account" options={{ title: 'حسابي', tabBarIcon: icon('person-outline', 'person') }} />
    </Tabs>
  );
}
