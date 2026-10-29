import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cancelSocialPost, formatDateTime, getImageUrl, retrySocialPost, TIKTOK_PRIVACY_LABELS } from '@wasit/shared';
import { AppText, brand, colors, useTheme } from '@wasit/ui';
import { ActionButton, Card, Chip, Empty, Screen } from '../../components/kit';
import { confirmDialog } from '../../lib/dialog';
import { isVideo, PLATFORM_ICON, PLATFORM_LABEL, POST_STATUS, useRefreshPosts, useSocialPosts } from '../../lib/socialPosts';
import { toast } from '../../lib/toast';

const Row = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 }}>
      <AppText muted style={{ fontSize: 13.5 }}>{label}</AppText>
      <AppText weight="bold" style={{ fontSize: 13.5, flexShrink: 1, textAlign: 'left' }}>{value}</AppText>
    </View>
  ) : null;

// تفاصيل منشور واحد: الاسم كاملاً، المنصة والحالة والمواعيد والخصوصية، كل الصور، النص كاملاً، والخطأ إن وُجد
export default function SocialPostDetail() {
  useTheme();
  const { id, platform } = useLocalSearchParams<{ id: string; platform: string }>();
  const q = useSocialPosts();
  const refresh = useRefreshPosts();
  const [busy, setBusy] = useState(false);
  const p = (q.data ?? []).find((x) => x.id === id && x.platform === platform);

  if (!p) {
    return (
      <Screen title="تفاصيل المنشور" back>
        {q.isLoading ? <AppText muted>جاري التحميل...</AppText> : <Empty icon="calendar-outline" text="لم نجد هذا المنشور" />}
      </Screen>
    );
  }

  const st = POST_STATUS[p.status] ?? { label: p.status, tone: 'muted' as const };
  const failed = p.status === 'FAILED';

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّر تنفيذ الإجراء');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="تفاصيل المنشور" back refreshing={q.isRefetching} onRefresh={refresh}>
      <Card tone={failed ? 'bad' : p.status === 'PUBLISHED' ? 'ok' : undefined}>
        <AppText weight="extraBold" style={{ fontSize: 18, lineHeight: 28 }}>{p.productName || 'منشور'}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Ionicons name={PLATFORM_ICON[p.platform]} size={18} color={colors.text} />
          <AppText weight="bold">{PLATFORM_LABEL[p.platform]}</AppText>
          <Chip label={st.label} tone={st.tone} />
        </View>
        {!!p.error && p.status !== 'PUBLISHED' && (
          <View style={{ backgroundColor: '#FEE2E2', borderRadius: 12, padding: 10 }}>
            <AppText weight="bold" style={{ fontSize: 13, color: '#A8322C' }}>{failed ? 'سبب الفشل' : 'ملاحظة'}</AppText>
            <AppText style={{ fontSize: 13.5, lineHeight: 22, color: '#A8322C' }} selectable>{p.error}</AppText>
          </View>
        )}
      </Card>

      <Card>
        {p.platform === 'tiktok' && <Row label="من يشاهده" value={p.privacyLevel ? TIKTOK_PRIVACY_LABELS[p.privacyLevel] ?? p.privacyLevel : null} />}
        <Row label="موعد النشر المحدد" value={p.scheduledAt ? formatDateTime(p.scheduledAt) : null} />
        <Row label="وقت النشر الفعلي" value={p.publishedAt ? formatDateTime(p.publishedAt) : null} />
        <Row label="أُنشئ في" value={p.createdAt ? formatDateTime(p.createdAt) : null} />
        <Row label="عدد العناصر" value={`${p.media.length}${p.media.some(isVideo) ? ' (فيها فيديو)' : ''}`} />
      </Card>

      {p.media.length > 0 && (
        <Card>
          <AppText weight="bold">الوسائط</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {p.media.map((m, i) => (
              <View key={`${m}-${i}`} style={{ width: 110, height: 110, borderRadius: 12, overflow: 'hidden', backgroundColor: brand.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                {isVideo(m) ? <Ionicons name="play-circle" size={36} color={colors.textMuted} /> : <Image source={{ uri: getImageUrl(m, 600) ?? m }} style={{ width: '100%', height: '100%' }} contentFit="cover" />}
              </View>
            ))}
          </ScrollView>
        </Card>
      )}

      {!!p.caption && (
        <Card>
          <AppText weight="bold">نص المنشور</AppText>
          <AppText style={{ fontSize: 14, lineHeight: 24 }} selectable>{p.caption}</AppText>
        </Card>
      )}

      <View style={{ gap: 8 }}>
        {p.status === 'PUBLISHED' && !!p.permalink && <ActionButton title="عرض المنشور على المنصة" icon="open-outline" onPress={() => Linking.openURL(p.permalink!)} />}
        {failed && <ActionButton title="إعادة المحاولة" icon="refresh-outline" loading={busy} onPress={() => run(() => retrySocialPost(p.platform, p.id), 'أُعيدت المحاولة')} />}
        {p.status === 'SCHEDULED' && (
          <ActionButton
            title="إلغاء الجدولة"
            tone="bad"
            loading={busy}
            onPress={() => confirmDialog({ title: 'إلغاء هذا المنشور المجدول؟', message: 'لن يُنشر في موعده.', confirmText: 'إلغاء الجدولة', tone: 'danger', onConfirm: () => run(() => cancelSocialPost(p.platform, p.id), 'أُلغيت الجدولة') })}
          />
        )}
        {!!p.productId && <ActionButton title="فتح المنتج" icon="cube-outline" tone="ghost" onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.productId! } })} />}
      </View>
    </Screen>
  );
}
