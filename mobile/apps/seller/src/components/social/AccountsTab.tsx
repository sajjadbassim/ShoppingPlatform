import { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { completeSocialConnect, disconnectSocial, fetchFacebookPages, fetchSocialConnectUrl, fetchSocialStatus, formatDateTime, selectFacebookPage, SOCIAL_PLATFORMS, socialAccountName, syncSocial, type FacebookPageOption, type SocialPlatform } from '@wasit/shared';
import { Ionicons } from '@expo/vector-icons';
import { AppText, colors, useTheme } from '@wasit/ui';
import { ActionButton, Card, Chip, IconTile } from '../kit';
import { MiniButton } from './MiniButton';
import { confirmDialog } from '../../lib/dialog';
import { toast } from '../../lib/toast';

// ربط حسابات التواصل: موافقة المنصة تتم في المتصفح، ثم تعيد المنصة المتصفح إلى رابط التطبيق (wasit-seller://social?platform&code&state)
// فيكمل التطبيق الربط بنفسه بـ JWT، بلا مرور على صفحة الويب. النشر من شاشة publish/[id] وسجله من social-posts
export function AccountsTab() {
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
    <>
      {pick && (
        <Card tone="warn">
          <AppText weight="extraBold" style={{ fontSize: 16 }}>اختر صفحة فيسبوك</AppText>
          <AppText muted style={{ fontSize: 12.5 }}>لديك أكثر من صفحة، اختر التي تريد ربطها بمتجرك.</AppText>
          {pick.pages.map((pg) => <ActionButton key={pg.id} title={pg.name || pg.id} icon="logo-facebook" tone="soft" onPress={() => choosePage(pg.id)} loading={picking} compact />)}
          <ActionButton title="إلغاء" tone="ghost" onPress={() => setPick(null)} compact />
        </Card>
      )}
      {SOCIAL_PLATFORMS.map((p) => <PlatformCard key={p.key} platform={p.key} label={p.label} />)}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingTop: 4 }}>
        <Ionicons name="information-circle-outline" size={18} color={colors.placeholder} />
        <AppText muted style={{ flex: 1, fontSize: 12.5, lineHeight: 20 }}>لنشر منتج على هذه الحسابات أو جدولته: افتح قائمة المنتجات، واضغط على النقاط الثلاث بجانب المنتج، ثم «نشر على التواصل».</AppText>
      </View>
    </>
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

  const removeLink = () =>
    confirmDialog({
      title: `إزالة ربط ${label}؟`,
      message: 'تختفي منشورات هذا الحساب من متجرك.',
      confirmText: 'إزالة',
      tone: 'danger',
      onConfirm: async () => {
        try { await disconnectSocial(platform); toast.success('أُزيل الربط'); refresh(); } catch (e) { toast.error((e as { message?: string }).message || 'تعذّر إزالة الربط'); }
      },
    });

  const needsLink = !s?.connected || s.needsReconnect;
  const sub = q.isLoading ? 'جاري التحقق...' : s?.connected ? name || 'متصل' : 'غير مربوط';

  return (
    <Card tone={s?.needsReconnect ? 'warn' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconTile icon={platform === 'instagram' ? 'logo-instagram' : platform === 'facebook' ? 'logo-facebook' : 'musical-notes-outline'} tone={s?.connected ? 'primary' : 'muted'} size={38} />
        <View style={{ flex: 1 }}>
          <AppText weight="bold" style={{ fontSize: 15 }}>{label}</AppText>
          <AppText muted numberOfLines={1} style={{ fontSize: 12.5 }}>{sub}</AppText>
        </View>
        {s?.needsReconnect ? <Chip label="يحتاج إعادة ربط" tone="warn" /> : s?.connected ? <Chip label="متصل" tone="ok" /> : null}
      </View>
      {!!s?.lastSyncAt && !needsLink && <AppText muted style={{ fontSize: 11.5 }}>آخر مزامنة: {formatDateTime(s.lastSyncAt)}</AppText>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {needsLink ? (
          <MiniButton title={s?.needsReconnect ? 'إعادة الربط' : 'ربط الحساب'} icon="link-outline" tone="solid" onPress={connect} loading={busy === 'connect'} />
        ) : (
          <>
            <MiniButton title="مزامنة" icon="sync-outline" tone="soft" onPress={sync} loading={busy === 'sync'} />
            <MiniButton title="إزالة الربط" icon="unlink-outline" tone="bad" onPress={removeLink} />
          </>
        )}
      </View>
    </Card>
  );
}
