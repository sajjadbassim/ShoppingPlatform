import { Image } from 'expo-image';
import { View } from 'react-native';
import { router } from 'expo-router';
import { getImageUrl, logout } from '@wasit/shared';
import { AppText, createStyles, useTheme } from '@wasit/ui';
import { useDashboard, useProfile, useReturnTrips } from '../../api/useVendor';
import { ActionButton, Card, Chip, ListRow, Screen, SectionTitle } from '../../components/kit';
import { confirmDialog } from '../../lib/dialog';
import { useVendorSession } from '../../lib/vendor';

// «المزيد»: كل ما عدا التبويبات الأربعة، في ثلاث مجموعات
export default function MoreScreen() {
  useTheme();
  const { session, isStaff, can } = useVendorSession();
  const profile = useProfile();
  const dash = useDashboard();
  const trips = useReturnTrips();
  const p = profile.data;
  const unanswered = dash.data?.pendingReviews ?? 0;
  const tripsCount = (trips.data ?? []).length;

  const marketing = [
    can('reviews') && { icon: 'star-outline' as const, tone: 'warn' as const, title: 'التقييمات', subtitle: 'الرد على آراء الزبائن', badge: unanswered > 0 ? { label: `${unanswered} بلا رد` } : undefined, to: '/reviews' as const },
    can('marketing') && { icon: 'pricetag-outline' as const, tone: 'bad' as const, title: 'العروض والكوبونات', subtitle: 'خصومات على منتجاتك وكوبونات لزبائنك', to: '/promotions' as const },
    can('social') && { icon: 'link-outline' as const, tone: 'primary' as const, title: 'ربط الحسابات والنشر', subtitle: 'إنستغرام وفيسبوك وتيك توك', to: '/social' as const },
  ].filter(Boolean) as { icon: 'star-outline'; tone: 'warn'; title: string; subtitle: string; badge?: { label: string }; to: '/reviews' }[];

  const ops = [
    can('orders') && { icon: 'return-down-back-outline' as const, tone: 'primary' as const, title: 'المرتجعات العائدة', subtitle: 'بضاعة في طريقها إليك', badge: tripsCount > 0 ? { label: String(tripsCount), tone: 'primary' as const } : undefined, to: '/orders?tab=returns' as const },
    can('reports') && { icon: 'stats-chart-outline' as const, tone: 'ok' as const, title: 'التقارير', subtitle: 'مبيعات حسب الفترة وأفضل المنتجات', to: '/reports' as const },
  ].filter(Boolean) as { icon: 'stats-chart-outline'; tone: 'ok'; title: string; subtitle: string; badge?: { label: string; tone?: 'primary' }; to: '/reports' }[];

  const store = [
    can('settings') && { icon: 'storefront-outline' as const, title: 'معلومات المتجر', subtitle: 'الاسم والوصف والشعار والحد الأدنى للطلب', to: '/settings' as const },
    can('settings') && { icon: 'time-outline' as const, title: 'الأوقات والإشعارات', subtitle: 'استقبال الطلبات وأوقات العمل والتنبيهات', to: '/settings/hours' as const },
    !isStaff && { icon: 'people-outline' as const, title: 'الموظفون', subtitle: 'حسابات وصلاحيات فريقك (للمالك فقط)', to: '/staff' as const },
    { icon: 'pulse-outline' as const, title: 'سجل النشاط', subtitle: 'ما فعله كل شخص في متجرك ومتى', to: '/activity' as const },
  ].filter(Boolean) as { icon: 'storefront-outline'; title: string; subtitle: string; to: '/settings' }[];

  return (
    <Screen title="المزيد" tabs>
      <Card>
        <View style={styles.row}>
          <View style={styles.logo}>{p?.logoUrl ? <Image source={{ uri: getImageUrl(p.logoUrl, 200) ?? undefined }} style={{ flex: 1 }} contentFit="cover" /> : <AppText weight="extraBold" style={{ color: '#FFFFFF', fontSize: 22 }}>{(p?.nameAr || 'م').slice(0, 1)}</AppText>}</View>
          <View style={{ flex: 1 }}>
            <AppText weight="extraBold" style={{ fontSize: 17 }} numberOfLines={1}>{p?.nameAr || 'متجري'}</AppText>
            <AppText muted style={{ fontSize: 12.5 }}>{isStaff ? 'موظف' : 'صاحب المتجر'} · {session?.fullName}</AppText>
          </View>
          {p && <Chip label={p.isActive ? 'نشط' : 'معطّل'} tone={p.isActive ? 'ok' : 'bad'} />}
        </View>
      </Card>

      {marketing.length > 0 && (
        <>
          <SectionTitle>الزبائن والتسويق</SectionTitle>
          <Card pad={4}>{marketing.map((m, i) => <ListRow key={m.to} icon={m.icon} tone={m.tone} title={m.title} subtitle={m.subtitle} badge={m.badge} onPress={() => router.push(m.to)} last={i === marketing.length - 1} />)}</Card>
        </>
      )}
      {ops.length > 0 && (
        <>
          <SectionTitle>العمليات</SectionTitle>
          <Card pad={4}>{ops.map((m, i) => <ListRow key={m.to} icon={m.icon} tone={m.tone} title={m.title} subtitle={m.subtitle} badge={m.badge} onPress={() => router.push(m.to)} last={i === ops.length - 1} />)}</Card>
        </>
      )}
      <SectionTitle>المتجر والفريق</SectionTitle>
      <Card pad={4}>{store.map((m, i) => <ListRow key={m.to} icon={m.icon} tone="muted" title={m.title} subtitle={m.subtitle} onPress={() => router.push(m.to)} last={i === store.length - 1} />)}</Card>

      <View style={{ flexDirection: 'row' }}>
        <ActionButton title="تسجيل الخروج" icon="log-out-outline" tone="bad" onPress={() => confirmDialog({ title: 'تسجيل الخروج؟', message: 'ستحتاج لإدخال رقمك وكلمة المرور مجدداً.', confirmText: 'خروج', tone: 'danger', onConfirm: () => logout() })} />
      </View>
    </Screen>
  );
}

const styles = createStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#D4621A', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
}));
