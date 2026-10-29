import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cancelSocialPost, formatDateTime, getImageUrl, retrySocialPost, TIKTOK_PRIVACY_LABELS, type SocialPost } from '@wasit/shared';
import { AppText, brand, colors, useTheme } from '@wasit/ui';
import { ActionButton, Card, Chip, Empty, FilterPills, Screen } from '../components/kit';
import { SwipeReveal } from '../components/SwipeReveal';
import { confirmDialog } from '../lib/dialog';
import { isVideo, PLATFORM_ICON, PLATFORM_LABEL, POST_STATUS, postKey, useRefreshPosts, useSocialPosts } from '../lib/socialPosts';
import { toast } from '../lib/toast';

type Filter = 'all' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';

// سجل المنشورات على إنستغرام وتيك توك: النقر على البطاقة يفتح تفاصيل المنشور، والمجدولة تُلغى والفاشلة تُعاد
export default function SocialPostsScreen() {
  useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const q = useSocialPosts();
  const refresh = useRefreshPosts();
  const all = q.data ?? [];
  const count = (s: Filter) => (s === 'all' ? all.length : all.filter((p) => p.status === s).length);
  const shown = filter === 'all' ? all : all.filter((p) => p.status === filter);

  const run = async (p: SocialPost, fn: () => Promise<unknown>, ok: string) => {
    setBusy(p.id);
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّر تنفيذ الإجراء');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title="سجل المنشورات" subtitle="اضغط على منشور لرؤية تفاصيله" back refreshing={q.isRefetching} onRefresh={refresh}>
      <FilterPills<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { key: 'all', label: 'الكل', count: count('all') },
          { key: 'SCHEDULED', label: 'مجدول', count: count('SCHEDULED') },
          { key: 'PUBLISHED', label: 'منشور', count: count('PUBLISHED') },
          { key: 'FAILED', label: 'فشل', count: count('FAILED'), alert: count('FAILED') > 0 },
        ]}
      />
      {!q.isLoading && shown.length === 0 && <Empty icon="calendar-outline" text={filter === 'all' ? 'لا منشورات بعد. انشر منتجاً من قائمة المنتجات' : 'لا منشورات بهذه الحالة'} />}
      {shown.map((p) => {
        const st = POST_STATUS[p.status] ?? { label: p.status, tone: 'muted' as const };
        const img = p.media.find((m) => !isVideo(m));
        const failed = p.status === 'FAILED';
        const dateLabel = p.status === 'PUBLISHED' ? 'نُشر' : p.status === 'SCHEDULED' ? 'يُنشر' : failed ? 'محاولة' : 'أُنشئ';
        const at = p.status === 'PUBLISHED' ? p.publishedAt ?? p.createdAt : p.scheduledAt ?? p.createdAt;
        return (
          <SwipeReveal key={postKey(p)}>
          <Card tone={failed ? 'bad' : undefined} onPress={() => router.push({ pathname: '/social-post/[id]', params: { id: p.id, platform: p.platform } })}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: brand.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                {img ? <Image source={{ uri: getImageUrl(img, 200) ?? img }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Ionicons name="videocam-outline" size={26} color={colors.textMuted} />}
                {p.media.length > 1 && (
                  <View style={{ position: 'absolute', bottom: 3, start: 3, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 5 }}>
                    <AppText weight="bold" style={{ color: '#FFFFFF', fontSize: 10.5, lineHeight: 16 }}>{p.media.length}</AppText>
                  </View>
                )}
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <AppText weight="extraBold" style={{ fontSize: 15.5, lineHeight: 24 }}>{p.productName || 'منشور'}</AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name={PLATFORM_ICON[p.platform]} size={15} color={colors.textMuted} />
                    <AppText muted style={{ fontSize: 12.5 }}>{PLATFORM_LABEL[p.platform]}</AppText>
                  </View>
                  <Chip label={st.label} tone={st.tone} />
                  {p.platform === 'tiktok' && !!p.privacyLevel && <Chip label={TIKTOK_PRIVACY_LABELS[p.privacyLevel] ?? p.privacyLevel} tone="muted" />}
                </View>
                {!!at && <AppText muted style={{ fontSize: 12.5 }}>{dateLabel} {formatDateTime(at)}</AppText>}
              </View>
              <Ionicons name="chevron-back" size={18} color={colors.placeholder} style={{ alignSelf: 'center' }} />
            </View>
            {!!p.caption && <AppText muted style={{ fontSize: 13, lineHeight: 21 }} numberOfLines={2}>{p.caption}</AppText>}
            {!!p.error && p.status !== 'PUBLISHED' && <AppText style={{ fontSize: 12.5, lineHeight: 20, color: colors.error }} numberOfLines={3}>{p.error}</AppText>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {p.status === 'PUBLISHED' && !!p.permalink && <ActionButton title="عرض المنشور" icon="open-outline" tone="soft" compact onPress={() => Linking.openURL(p.permalink!)} />}
              {failed && <ActionButton title="إعادة المحاولة" icon="refresh-outline" tone="soft" compact loading={busy === p.id} onPress={() => run(p, () => retrySocialPost(p.platform, p.id), 'أُعيدت المحاولة')} />}
              {p.status === 'SCHEDULED' && (
                <ActionButton
                  title="إلغاء الجدولة"
                  tone="bad"
                  compact
                  loading={busy === p.id}
                  onPress={() => confirmDialog({ title: 'إلغاء هذا المنشور المجدول؟', message: 'لن يُنشر في موعده.', confirmText: 'إلغاء الجدولة', tone: 'danger', onConfirm: () => run(p, () => cancelSocialPost(p.platform, p.id), 'أُلغيت الجدولة') })}
                />
              )}
            </View>
          </Card>
          </SwipeReveal>
        );
      })}
    </Screen>
  );
}
