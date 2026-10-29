import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { deleteReviewReply, formatDate, getImageUrl, replyToReview, type VendorReview } from '@wasit/shared';
import { AppText, colors, createStyles, fonts, StarRating, useTheme , tc } from '@wasit/ui';
import { useReviewSummary, useReviews } from '../api/useVendor';
import { ActionButton, Card, Chip, Empty, Screen, Segmented } from '../components/kit';
import { confirmDialog } from '../lib/dialog';
import { toast } from '../lib/toast';
import { palette } from '../lib/palette';

// آراء الزبائن: ملخص، وقائمة «بانتظار ردك» أو الكل، والرد يظهر للجميع تحت التقييم
export default function ReviewsScreen() {
  useTheme();
  const [tab, setTab] = useState<'unanswered' | 'all'>('unanswered');
  const summary = useReviewSummary();
  const list = useReviews(tab === 'unanswered');
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const s = summary.data;
  const total = s?.totalReviews ?? 0;

  return (
    <Screen title="التقييمات" subtitle="ما يقوله الزبائن عن منتجاتك" back refreshing={list.isRefetching} onRefresh={() => { list.refetch(); summary.refetch(); }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <AppText weight="extraBold" style={{ fontSize: 40, lineHeight: 52 }}>{(s?.averageRating ?? 0).toFixed(1)}</AppText>
            <StarRating value={Math.round(s?.averageRating ?? 0)} size={16} />
            <AppText muted style={{ fontSize: 12.5 }}>{total} تقييم</AppText>
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = s?.distribution?.[star] ?? s?.distribution?.[String(star)] ?? 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AppText muted style={{ fontSize: 12, width: 12 }}>{star}</AppText>
                  <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
                  <AppText muted style={{ fontSize: 11.5, width: 22 }}>{count}</AppText>
                </View>
              );
            })}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={`${s?.totalVerified ?? 0} مشتري موثق`} tone="ok" />
          <Chip label={`${s?.totalWithImages ?? 0} مع صور`} tone="primary" />
        </View>
      </Card>

      <Segmented value={tab} onChange={setTab} options={[{ key: 'unanswered', label: 'بانتظار ردك' }, { key: 'all', label: 'كل التقييمات' }]} />

      {list.isLoading ? (
        <AppText muted style={{ textAlign: 'center', paddingVertical: 30 }}>جاري التحميل...</AppText>
      ) : items.length === 0 ? (
        <Empty icon="star-outline" text={tab === 'unanswered' ? 'لا توجد تقييمات تنتظر ردك' : 'لا توجد تقييمات بعد'} />
      ) : (
        items.map((r) => <ReviewCard key={r.id} review={r} />)
      )}
      {list.hasNextPage && <ActionButton title={list.isFetchingNextPage ? 'جاري التحميل...' : 'عرض المزيد'} tone="ghost" onPress={() => list.fetchNextPage()} />}
    </Screen>
  );
}

function ReviewCard({ review: r }: { review: VendorReview }) {
  useTheme();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(r.vendorReply ?? '');
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['v-reviews'] });
    queryClient.invalidateQueries({ queryKey: ['v-dashboard'] });
  };

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await replyToReview(r.id, text.trim());
      toast.success('تم نشر ردك، ويظهر للزبائن تحت التقييم');
      setEditing(false);
      refresh();
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّر إرسال الرد');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={styles.thumb}>{r.productImageUrl ? <Image source={{ uri: getImageUrl(r.productImageUrl, 200) ?? undefined }} style={{ flex: 1 }} contentFit="cover" /> : null}</View>
        <View style={{ flex: 1 }}>
          <AppText weight="bold" style={{ fontSize: 14.5 }}>{r.customerName || 'زبون'}</AppText>
          <AppText muted style={{ fontSize: 12 }} numberOfLines={1}>{r.productName} · {formatDate(r.createdAt)}</AppText>
        </View>
        <StarRating value={r.rating} size={14} />
      </View>
      {r.isVerifiedPurchase && <Chip label="مشتري موثق" tone="ok" />}
      {!!r.title && <AppText weight="bold" style={{ fontSize: 15 }}>{r.title}</AppText>}
      {!!r.body && <AppText style={{ fontSize: 14.5, lineHeight: 24 }}>{r.body}</AppText>}
      {r.images?.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {r.images.slice(0, 4).map((u, i) => <View key={i} style={styles.photo}><Image source={{ uri: getImageUrl(u, 200) ?? undefined }} style={{ flex: 1 }} contentFit="cover" /></View>)}
        </View>
      )}

      {r.vendorReply && !editing ? (
        <View style={styles.reply}>
          <AppText weight="extraBold" style={{ fontSize: 12, color: colors.primaryHover }}>ردّك</AppText>
          <AppText style={{ fontSize: 14, lineHeight: 23 }}>{r.vendorReply}</AppText>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <AppText weight="bold" onPress={() => { setText(r.vendorReply ?? ''); setEditing(true); }} style={{ fontSize: 13, color: colors.primaryHover }}>تعديل الرد</AppText>
            <AppText weight="bold" onPress={() => confirmDialog({ title: 'حذف ردّك؟', confirmText: 'حذف', tone: 'danger', onConfirm: async () => { try { await deleteReviewReply(r.id); toast.success('تم حذف الرد'); refresh(); } catch (e) { toast.error((e as { message?: string }).message || 'تعذّر الحذف'); } } })} style={{ fontSize: 13, color: colors.errorDark }}>حذف الرد</AppText>
          </View>
        </View>
      ) : editing || !r.vendorReply ? (
        <View style={{ gap: 8 }}>
          <TextInput value={text} onChangeText={setText} multiline maxLength={1000} placeholder="اكتب رداً لطيفاً يراه كل الزبائن تحت التقييم" placeholderTextColor={colors.placeholder} style={styles.input} textAlign="right" onFocus={() => setEditing(true)} />
          {editing && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ActionButton title="إلغاء" tone="ghost" compact onPress={() => { setEditing(false); setText(r.vendorReply ?? ''); }} disabled={busy} />
              <ActionButton title="إرسال الرد" compact onPress={send} loading={busy} disabled={!text.trim()} />
            </View>
          )}
        </View>
      ) : null}
    </Card>
  );
}

const styles = createStyles(() => ({
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: tc('#F3E6D2') },
  fill: { height: 7, borderRadius: 4, backgroundColor: palette.amber },
  thumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: tc('#F8ECDA'), overflow: 'hidden' },
  photo: { width: 62, height: 62, borderRadius: 12, backgroundColor: tc('#F8ECDA'), overflow: 'hidden' },
  reply: { backgroundColor: tc('#FEF3E2'), borderRadius: 14, padding: 12, gap: 4 },
  input: { minHeight: 72, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 14, padding: 12, fontFamily: fonts.regular, fontSize: 14.5, color: colors.text, textAlignVertical: 'top' },
}));
