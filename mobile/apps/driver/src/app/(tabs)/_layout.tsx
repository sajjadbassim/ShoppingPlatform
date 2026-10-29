import { Pressable, View } from 'react-native';
import { router, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, brand, colors, fonts, useTheme } from '@wasit/ui';
import { useDriverProfile } from '../../api/useDriver';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, { off: IconName; on: IconName }> = {
  index: { off: 'cube-outline', on: 'cube' },
  returns: { off: 'arrow-undo-outline', on: 'arrow-undo' },
  cash: { off: 'cash-outline', on: 'cash' },
  account: { off: 'person-outline', on: 'person' },
};

// تبويبات تُفتح من مكان آخر ولا تظهر في الشريط
const HIDDEN_TABS = ['account'];

// زر مسح الباركود: دائرة برتقالية بجانب كبسولة التبويبات وبارتفاعها (في بداية الشريط)، تفتح الكاميرا لقراءة رقم الطلب
function ScanButton() {
  useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="مسح باركود الطلب"
      onPress={() => router.push('/scan')}
      style={({ pressed }) => ({
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 12,
        shadowColor: colors.primary,
        shadowOpacity: 0.35,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <MaterialCommunityIcons name="qrcode-scan" size={26} color="#FFFFFF" />
    </Pressable>
  );
}

// شريط عائم بكبسولة: التبويب النشط يعرض أيقونته واسمه بلون البرتقالي، وغيره أيقونة فقط.
function FloatingTabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  useTheme();
  const insets = useSafeAreaInsets();
  // «حسابي» يُفتح من الترويسة ولا يظهر في الشريط (HIDDEN_TABS) ليتّسع الشريط لزر المسح
  const visible = state.routes.map((route, index) => ({ route, index })).filter(({ route }) => !HIDDEN_TABS.includes(route.name));

  const anyFocused = visible.some((v) => v.index === state.index);

  const renderTab = ({ route, index: i }: (typeof visible)[number]) => {
    const focused = state.index === i;
    const { options } = descriptors[route.key];
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
          ...(focused ? { flex: 1 } : anyFocused ? { width: 46 } : { flex: 1 }),
          height: 46,
          borderRadius: 23,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          backgroundColor: focused ? colors.primaryLight : brand.surfaceMuted,
        }}
      >
        <Ionicons name={focused ? icon.on : icon.off} size={focused ? 18 : 20} color={focused ? colors.primary : colors.textMuted} />
        {focused && (
          <AppText weight="bold" numberOfLines={1} style={{ fontSize: 12, color: colors.primary }}>{options.title}</AppText>
        )}
        {!!badge && (
          <View style={{ position: 'absolute', top: 3, end: focused ? 6 : 8, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
            <AppText weight="bold" style={{ fontSize: 10.5, lineHeight: 15, color: '#FFFFFF', fontFamily: fonts.bold }}>{String(badge)}</AppText>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', start: 16, end: 16, bottom: insets.bottom + 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <ScanButton />
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          padding: 6,
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
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>{visible.map(renderTab)}</View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  useTheme();
  const { data: me } = useDriverProfile();
  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'shift', transitionSpec: { animation: 'timing', config: { duration: 280 } } }} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'الطلبات', tabBarBadge: me?.activeOrders || undefined }} />
      <Tabs.Screen name="returns" options={{ title: 'المرتجعات', tabBarBadge: me?.openReturnTrips || undefined }} />
      <Tabs.Screen name="cash" options={{ title: 'النقد' }} />
      <Tabs.Screen name="account" options={{ title: 'حسابي' }} />
    </Tabs>
  );
}
