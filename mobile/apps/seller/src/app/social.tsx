import { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { completeSocialConnect, disconnectSocial, fetchFacebookPages, fetchSocialConnectUrl, fetchSocialStatus, formatDateTime, selectFacebookPage, SOCIAL_PLATFORMS, socialAccountName, syncSocial, type FacebookPageOption, type SocialPlatform } from '@wasit/shared';
import { AppText, useTheme } from '@wasit/ui';
import { ActionButton, Card, Chip, IconTile, Screen } from '../components/kit';
import { confirmDialog } from '../lib/dialog';
import { toast } from '../lib/toast';

// ربط حسابات التواصل: موافقة المنصة تتم في المتصفح، ثم تعيد المنصة المتصفح إلى رابط التطبيق (wasit-seller://social?platform&code&state)
// فيكمل التطبيق الربط بنفسه بـ JWT، بلا مرور على صفحة الويب. النشر على الحسابات من لوحة الويب حالياً
export default function SocialScreen() {
  useTheme();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ platform?: string; code?: string; state?: string; error?: string }>();
  const handled = useRef<string | null>(null);
  // فيسبوك: للتاجر أكثر من صفحة فيختار واحدة بعد عودته من المتصفح
  const [pick, setPick] = useState<{ selectionId: string; pages: FacebookPageOption[] } | null>(null);
  const [picking, setPicking] = useState(false);

  const choosePage = async (pageId: string) => {
    if (!pick) return;
    setPicking(true);
    try {
      await selectFacebookPage(pick.selectionId, pageId);
      toast.success('تم ربط فيسبوك');
      setPick(null);
      queryClient.invalidateQueries({ queryKey: ['v-social', 'facebook'] });
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّر ربط الصفحة');
    } finally {
      setPicking(false);
    }
  };

  useEffect(() => {
    const { platform, code, state, error } = params;
    const key = `${platform ?? ''}|${state ?? ''}|${error ?? ''}`;
    if (!platform || (!state && !error) || handled.current === key) return;
    handled.current = key;
    const p = SOCIAL_PLATFORMS.find((x) => x.key === platform);
    const clear = () => router.setParams({ platform: undefined, code: undefined, state: undefined, error: undefined });
    if (!p) { clear(); return; }
    if (error || !code || !state) {
      toast.error(error === 'access_denied' ? 'لم تمنح المنصة الإذن للربط' : 'تعذّر إكمال الربط، حاول مرة أخرى');
      clear();
      return;
    }
    completeSocialConnect(p.key, code, state)
      .then(async ({ selectionId }) => {
        if (selectionId) {
          const pages = await fetchFacebookPages(selectionId);
          setPick({ selectionId, pages });
          toast.info('اختر الصفحة التي تريد ربطها');
          return;
        }
        toast.success(`تم ربط ${p.label}`);
        queryClient.invalidateQueries({ queryKey: ['v-social', p.key] });
      })
      .catch((e) => toast.error((e as { message?: string }).message || 'تعذّر إكمال الربط'))
      .finally(clear);
  }, [params, queryClient]);

  return (
    <Screen title="ربط الحسابات" subtitle="اربط حساباتك لتظهر منشوراتك في متجرك وفي ريلز" back>
      {pick && (
        <Card tone="warn">
          <AppText weight="extraBold" style={{ fontSize: 16 }}>اختر صفحة فيسبوك</AppText>
          <AppText muted style={{ fontSize: 12.5 }}>لديك أكثر من صفحة، اختر التي تريد ربطها بمتجرك.</AppText>
          {pick.pages.map((pg) => <ActionButton key={pg.id} title={pg.name || pg.id} icon="logo-facebook" tone="soft" onPress={() => choosePage(pg.id)} loading={picking} compact />)}
          <ActionButton title="إلغاء" tone="ghost" onPress={() => setPick(null)} compact />
        </Card>
      )}
      {SOCIAL_PLATFORMS.map((p) => <PlatformCard key={p.key} platform={p.key} label={p.label} />)}
      <Card>
        <AppText muted style={{ fontSize: 13, lineHeight: 22 }}>نشر المنتجات على هذه الحسابات وجدولتها غير متاح في التطبيق بعد، ويتم من لوحة التاجر على الويب.</AppText>
      </Card>
    </Screen>
  );
}

function PlatformCard({ platform, label }: { platform: SocialPlatform; label: string }) {
  useTheme();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['v-social', platform], queryFn: () => fetchSocialStatus(platform), retry: false });
  const [busy, setBusy] = useState<'connect' | 'sync' | null>(null);
  const s = q.data;
  const name = socialAccountName(s);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['v-social', platform] });

  const connect = async () => {
    setBusy('connect');
    try {
      const url = await fetchSocialConnectUrl(platform);
      if (!url) throw new Error('تعذّر الحصول على رابط الربط');
      await Linking.openURL(url);
      toast.info('أكمل الربط في المتصفح وسيعيدك إلى التطبيق تلقائياً');
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّر بدء الربط');
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy('sync');
    try {
      await syncSocial(platform);
      toast.success('تمت المزامنة');
      refresh();
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّرت المزامنة');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card tone={s?.needsReconnect ? 'warn' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile icon={platform === 'instagram' ? 'logo-instagram' : platform === 'facebook' ? 'logo-facebook' : 'musical-notes-outline'} tone={s?.connected ? 'primary' : 'muted'} />
        <View style={{ flex: 1 }}>
          <AppText weight="extraBold" style={{ fontSize: 16 }}>{label}</AppText>
          <AppText muted style={{ fontSize: 12.5 }}>{q.isLoading ? 'جاري التحقق...' : s?.connected ? name || 'متصل' : 'غير مربوط'}</AppText>
        </View>
        {s?.needsReconnect ? <Chip label="يحتاج إعادة ربط" tone="warn" /> : s?.connected ? <Chip label="متصل" tone="ok" /> : null}
      </View>
      {s?.lastSyncAt && <AppText muted style={{ fontSize: 12 }}>آخر مزامنة: {formatDateTime(s.lastSyncAt)}</AppText>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {!s?.connected || s.needsReconnect ? (
          <ActionButton title={s?.needsReconnect ? 'إعادة الربط' : 'ربط الحساب'} icon="link-outline" onPress={connect} loading={busy === 'connect'} compact />
        ) : (
          <>
            <ActionButton title="مزامنة الآن" icon="sync-outline" tone="soft" onPress={sync} loading={busy === 'sync'} compact />
            <ActionButton title="إزالة الربط" tone="bad" compact onPress={() => confirmDialog({ title: `إزالة ربط ${label}؟`, message: 'تختفي منشورات هذا الحساب من متجرك.', confirmText: 'إزالة', tone: 'danger', onConfirm: async () => { try { await disconnectSocial(platform); toast.success('أُزيل الربط'); refresh(); } catch (e) { toast.error((e as { message?: string }).message || 'تعذّر إزالة الربط'); } } })} />
          </>
        )}
        <ActionButton title="تحديث" tone="ghost" compact onPress={() => q.refetch()} />
      </View>
    </Card>
  );
}
