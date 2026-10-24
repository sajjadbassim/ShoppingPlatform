import { Tabs } from 'expo-router';
import { AppHeader } from '../../components/AppHeader';
import { TabBar } from '../../components/TabBar';

// التبويبات الرئيسية: الرأس الموحّد في الأعلى، والشريط السفلي. سهم الرجوع في غير الرئيسية كما في الويب
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ header: () => <AppHeader /> }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="categories" options={{ header: () => <AppHeader back /> }} />
      <Tabs.Screen name="cart" options={{ header: () => <AppHeader back /> }} />
      <Tabs.Screen name="account" options={{ header: () => <AppHeader back /> }} />
    </Tabs>
  );
}
