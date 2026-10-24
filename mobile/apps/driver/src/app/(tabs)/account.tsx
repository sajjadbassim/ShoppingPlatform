import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { canReceiveOrders, logout } from '@wasit/shared';
import { AppText, colors, createStyles, useTheme } from '@wasit/ui';
import { useDriverProfile } from '../../api/useDriver';
import { ActionButton, Card, Chip, money, Screen } from '../../components/kit';
import { confirmDialog } from '../../lib/dialog';
import { changeTheme } from '../../lib/theme';
import { getTrackingPermission, type TrackingPermission } from '../../lib/tracking';

export default function AccountScreen() {
  const dark = useTheme() === 'dark';
  const { data: me } = useDriverProfile();
  const [permission, setPermission] = useState<TrackingPermission | null>(null);

  const refresh = useCallback(() => getTrackingPermission().then(setPermission).catch(() => {}), []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const working = canReceiveOrders(me?.workStatus);

  return (
    <Screen title="حسابي">
      <Card>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <View style={styles.avatar}>
            <AppText style={{ fontSize: 32, lineHeight: 44 }}>🛵</AppText>
          </View>
          <AppText weight="extraBold" style={{ fontSize: 18 }}>{me?.fullName ?? '...'}</AppText>
          <AppText muted style={{ writingDirection: 'ltr' }}>{'‎'}{me?.phone}</AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label={`التقييم ${Number(me?.rating ?? 0).toFixed(1)} ★`} tone="warn" />
            <Chip label={`${me?.totalDeliveries ?? 0} توصيلة`} tone="muted" />
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.row}>
          <AppText>نقد بعهدتك</AppText>
          <AppText weight="bold">{money(me?.cashInHand)}</AppText>
        </View>
        <View style={styles.row}>
          <AppText>تتبّع الموقع</AppText>
          {permission === 'always' ? (
            <Chip label={working ? 'يعمل' : 'جاهز'} tone="ok" />
          ) : (
            <Chip label={permission === 'foreground' ? 'يحتاج «طوال الوقت»' : 'غير ممنوح'} tone="warn" />
          )}
        </View>
        {permission !== 'always' && (
          <ActionButton title="إعطاء إذن الموقع" icon="location-outline" tone="ghost" onPress={() => router.push('/location-permission')} />
        )}
      </Card>

      <Card>
        <View style={styles.row}>
          <AppText>الوضع الداكن</AppText>
          <Switch value={dark} onValueChange={(v) => changeTheme(v ? 'dark' : 'light')} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
        </View>
      </Card>

      <Card>
        <AppText weight="bold">إن توقف التتبّع في الخلفية</AppText>
        <AppText muted style={{ fontSize: 13, lineHeight: 22 }}>
          بعض الهواتف، مثل شاومي وسامسونج وأوبو، توقف التطبيقات لتوفير البطارية. افتح إعدادات التطبيق واختر البطارية ثم «بلا قيود».
        </AppText>
        <ActionButton title="فتح إعدادات التطبيق" icon="settings-outline" tone="ghost" onPress={() => Linking.openSettings()} />
      </Card>

      <ActionButton
        title="تسجيل الخروج"
        icon="log-out-outline"
        tone="bad"
        onPress={() =>
          confirmDialog({
            title: 'تسجيل الخروج؟',
            message: 'سيتوقف التتبّع ولن تصلك طلبات جديدة على هذا الهاتف.',
            confirmText: 'خروج',
            tone: 'danger',
            onConfirm: () => logout(),
          })
        }
      />
    </Screen>
  );
}

const styles = createStyles(() => ({
  avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
}));
