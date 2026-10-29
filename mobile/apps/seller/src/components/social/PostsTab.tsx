import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cancelSocialPost, formatDateTime, getImageUrl, retrySocialPost, TIKTOK_PRIVACY_LABELS, type SocialPost } from '@wasit/shared';
import { AppText, brand, colors, useTheme } from '@wasit/ui';
import { Card, Chip, Empty, FilterPills } from '../kit';
import { MiniButton } from './MiniButton';
import { SwipeReveal } from '../SwipeReveal';
import { confirmDialog } from '../../lib/dialog';
import { isVideo, PLATFORM_ICON, PLATFORM_LABEL, POST_STATUS, postKey, shortWhen, useRefreshPosts, useSocialPosts } from '../../lib/socialPosts';
import { toast } from '../../lib/toast';

type Filter = 'all' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';

// سجل المنشورات على إنستغرام وتيك توك: النقر على البطاقة يفتح تفاصيل المنشور، والمجدولة تُلغى والفاشلة تُعاد
export function PostsTab() {
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
    <>
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
        const priv = p.platform === 'tiktok' && p.privacyLevel ? TIKTOK_PRIVACY_LABELS[p.privacyLevel] ?? p.privacyLevel : null;
        return (
          <SwipeReveal key={postKey(p)}>
            <Card tone={failed ? 'bad' : undefined} pad={10} onPress={() => router.push({ pathname: '/social-post/[id]', params: { id: p.id, platform: p.platform } })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: brand.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                  {img ? <Image source={{ uri: getImageUrl(img, 200) ?? img }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Ionicons name="videocam-outline" size={24} color={colors.textMuted} />}
                  {p.media.length > 1 && (
                    <View style={{ position: 'absolute', bottom: 3, start: 3, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 5 }}>
                      <AppText weight="bold" style={{ color: '#FFFFFF', fontSize: 10, lineHeight: 15 }}>{p.media.length}</AppText>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <AppText weight="bold" numberOfLines={2} style={{ fontSize: 14.5, lineHeight: 22 }}>{p.productName || 'منشور'}</AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name={PLATFORM_ICON[p.platform]} size={14} color={colors.textMuted} />
                    <AppText muted style={{ fontSize: 12.5 }}>{PLATFORM_LABEL[p.platform]}{priv ? ` · ${priv}` : ''}</AppText>
                    <Chip label={st.label} tone={st.tone} />
                  </View>
                  {!!at && <AppText muted numberOfLines={1} style={{ fontSize: 12 }}>{dateLabel} {shortWhen(at)}</AppText>}
                </View>
                <Ionicons name="chevron-back" size={16} color={colors.placeholder} />
              </View>
              {!!p.error && p.status !== 'PUBLISHED' && <AppText numberOfLines={2} style={{ fontSize: 12, lineHeight: 18, color: colors.error }}>{p.error}</AppText>}
              {(failed || p.status === 'SCHEDULED' || (p.status === 'PUBLISHED' && !!p.permalink)) && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {p.status === 'PUBLISHED' && !!p.permalink && <MiniButton small title="عرض المنشور" icon="open-outline" tone="soft" onPress={() => Linking.openURL(p.permalink!)} />}
                  {failed && <MiniButton small title="إعادة المحاولة" icon="refresh-outline" tone="soft" loading={busy === p.id} onPress={() => run(p, () => retrySocialPost(p.platform, p.id), 'أُعيدت المحاولة')} />}
                  {p.status === 'SCHEDULED' && (
                    <MiniButton
                      small
                      title="إلغاء الجدولة"
                      icon="close-circle-outline"
                      tone="bad"
                      loading={busy === p.id}
                      onPress={() => confirmDialog({ title: 'إلغاء هذا المنشور المجدول؟', message: 'لن يُنشر في موعده.', confirmText: 'إلغاء الجدولة', tone: 'danger', onConfirm: () => run(p, () => cancelSocialPost(p.platform, p.id), 'أُلغيت الجدولة') })}
                    />
                  )}
                </View>
              )}
            </Card>
          </SwipeReveal>
        );
      })}
    </>
  );
}
