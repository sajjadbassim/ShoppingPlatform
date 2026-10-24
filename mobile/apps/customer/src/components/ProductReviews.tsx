import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  distributionShare,
  reviewableOrders,
  timeAgoAr,
  useSessionStore,
  validateReview,
  type ApiError,
  type AuthUser,
  type Review,
  type ReviewErrors,
} from '@wasit/shared';
import { AppText, Button, Input, StarRating, brand, colors, radius, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { useCreateReview, useMarkHelpful, useReviews, useReviewSummary } from '../api/useFeedback';
import { useOrders } from '../api/useOrders';
import { toast } from '../lib/toast';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ar-IQ-u-nu-latn', { timeZone: 'Asia/Baghdad', day: 'numeric', month: 'short', year: 'numeric' });

const SORTS = [
  { key: 'newest', label: 'الأحدث' },
  { key: 'highest', label: 'الأعلى تقييماً' },
  { key: 'lowest', label: 'الأقل تقييماً' },
] as const;

type SortKey = (typeof SORTS)[number]['key'];

const sortReviews = (items: Review[], key: SortKey) =>
  key === 'newest' ? items : [...items].sort((a, b) => (key === 'highest' ? b.rating - a.rating : a.rating - b.rating));

// بطاقة «التقييمات والمراجعات» كما في الويب: ملخص قابل للطي، التوزيع، الترتيب، القائمة، وكتابة تقييم داخل الصفحة
export function ProductReviews({ productId }: { productId: string }) {
  useTheme();
  const summary = useReviewSummary(productId);
  const reviews = useReviews(productId);
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [sortIndex, setSortIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const signedIn = useSessionStore((s) => s.signedIn);
  const me = (useSessionStore((s) => s.session) as AuthUser | null)?.userId;
  // الخادم يسمح بمراجعة واحدة لكل منتج: نعرف ذلك من قائمة المراجعات، أو من رفض الخادم عند محاولة الكتابة
  const [reviewedNow, setReviewedNow] = useState(false);

  const items = useMemo(
    () => sortReviews(reviews.data?.pages.flatMap((p) => p.items) ?? [], SORTS[sortIndex].key),
    [reviews.data, sortIndex],
  );

  const alreadyReviewed = reviewedNow || (!!me && items.some((r) => r.userId === me));

  if (summary.isLoading) return <ActivityIndicator color={colors.primary} />;
  if (!summary.data) return null;
  const s = summary.data;

  const startWriting = () => {
    if (!signedIn) return router.push('/login');
    setOpen(true);
    setWriting(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Ionicons name="star-outline" size={22} color={colors.text} />
        <AppText weight="extraBold" style={styles.title}>
          التقييمات والمراجعات
        </AppText>
      </View>

      <Pressable style={styles.toggle} onPress={() => setOpen((o) => !o)}>
        <Ionicons name="star" size={18} color={tc("#F59E0B")} />
        <AppText weight="bold" style={{ fontSize: 16 }}>
          {s.averageRating.toFixed(1)}
        </AppText>
        <AppText muted style={{ flex: 1 }}>
          ({s.totalReviews})
        </AppText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </Pressable>

      {open && (
        <>
          <View style={styles.summary}>
            <AppText weight="extraBold" style={styles.average}>
              {s.averageRating.toFixed(1)}
            </AppText>
            <StarRating value={s.averageRating} size={20} />
            <AppText muted>{s.totalReviews} تقييم</AppText>
            <View style={styles.bars}>
              {([5, 4, 3, 2, 1] as const).map((n) => (
                <View key={n} style={styles.barRow}>
                  <Ionicons name="star" size={14} color={tc("#F59E0B")} />
                  <AppText muted style={styles.barLabel}>
                    {n}
                  </AppText>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.round(distributionShare(s, n) * 100)}%` }]} />
                  </View>
                  <AppText muted style={styles.barCount}>
                    {s.distribution?.[String(n)] ?? 0}
                  </AppText>
                </View>
              ))}
            </View>
          </View>

          <Pressable style={styles.sort} onPress={() => setSortIndex((i) => (i + 1) % SORTS.length)}>
            <AppText weight="medium">{SORTS[sortIndex].label}</AppText>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>

        </>
      )}

      {items.length === 0 ? (
        <View style={styles.empty}>
          <AppText weight="medium" style={{ fontSize: 16 }}>
            لا توجد تقييمات بعد
          </AppText>
          <AppText muted style={styles.small}>
            كن أول من يقيّم هذا المنتج
          </AppText>
        </View>
      ) : (
        (showAll ? items : items.slice(0, 3)).map((r) => <ReviewRow key={r.id} review={r} productId={productId} />)
      )}
      {!showAll && s.totalReviews > 3 && (
        <Pressable
          style={styles.viewAll}
          onPress={() => {
            setShowAll(true);
            if (reviews.hasNextPage) reviews.fetchNextPage();
          }}
        >
          <AppText weight="medium" style={{ color: colors.primary, fontSize: 15 }}>
            عرض جميع المراجعات ({s.totalReviews})
          </AppText>
          <Ionicons name="chevron-back" size={16} color={colors.primary} />
        </Pressable>
      )}
      {showAll && reviews.hasNextPage && (
        <Button title="عرض المزيد" variant="outline" loading={reviews.isFetchingNextPage} onPress={() => reviews.fetchNextPage()} />
      )}

      {alreadyReviewed ? (
        <View style={styles.reviewedNote}>
          <Ionicons name="checkmark-circle" size={20} color={tc("#15803D")} />
          <AppText weight="medium" style={{ color: tc('#15803D'), fontSize: 15 }}>
            لقد قيّمت هذا المنتج، شكراً لك
          </AppText>
        </View>
      ) : writing ? (
        <ReviewForm
          productId={productId}
          onDone={() => setWriting(false)}
          onAlreadyReviewed={() => {
            setReviewedNow(true);
            setWriting(false);
          }}
        />
      ) : (
        <Pressable style={styles.writeButton} onPress={startWriting}>
          <Ionicons name="chatbox-ellipses-outline" size={20} color={colors.textMuted} />
          <AppText muted style={{ fontSize: 15 }}>
            اكتب تقييمك
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

// نموذج «كتابة تقييم»: النجوم، اختيار الطلب المسلَّم، العنوان، التفاصيل
function ReviewForm({ productId, onDone, onAlreadyReviewed }: { productId: string; onDone: () => void; onAlreadyReviewed: () => void }) {
  useTheme();
  const orders = useOrders();
  const create = useCreateReview();
  const [rating, setRating] = useState(0);
  const [orderId, setOrderId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const eligible = useMemo(
    () => reviewableOrders(orders.data ?? [], productId),
    [orders.data, productId],
  );
  const chosen = orderId ?? eligible[0]?.id;

  const submit = async () => {
    const found = validateReview({ rating, title, body });
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0 || !chosen) return;
    try {
      const review = await create.mutateAsync({ productId, orderId: chosen, rating, title, body });
      const points = review.pointsEarned ? ` وكسبت ${review.pointsEarned} نقطة ولاء` : '';
      toast.success(`تم نشر تقييمك${points}`, { title: 'شكراً لتقييمك' });
      onDone();
    } catch (e) {
      const message = (e as ApiError).message || 'تعذّر إرسال التقييم';
      // رفض الخادم لأنك قيّمت المنتج سابقاً: لا فائدة من إبقاء النموذج مفتوحاً
      if (message.includes('مسبقاً')) onAlreadyReviewed();
      else setServerError(message);
    }
  };

  return (
    <View style={styles.form}>
      <AppText weight="extraBold" style={styles.formTitle}>
        كتابة تقييم
      </AppText>

      <AppText weight="medium">تقييمك *</AppText>
      <View style={{ alignItems: 'flex-start' }}>
        <StarRating
          value={rating}
          size={34}
          onChange={(n) => {
            setRating(n);
            setErrors((p) => ({ ...p, rating: undefined }));
          }}
        />
      </View>
      {!!errors.rating && <AppText style={styles.error}>{errors.rating}</AppText>}

      <AppText weight="medium">اختر الطلب *</AppText>
      {orders.isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : eligible.length === 0 ? (
        <View style={styles.warning}>
          <AppText style={styles.warningText}>يجب أن تكون قد استلمت طلباً يحتوي على هذا المنتج لكتابة تقييم</AppText>
        </View>
      ) : (
        <View style={{ gap: spacing.xs }}>
          {eligible.map((o) => {
            const active = o.id === chosen;
            return (
              <Pressable key={o.id} style={[styles.orderOption, active && styles.orderOptionActive]} onPress={() => setOrderId(o.id)}>
                <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.primary : colors.placeholder} />
                <AppText weight="medium">طلب {o.orderNumber}</AppText>
              </Pressable>
            );
          })}
        </View>
      )}

      {serverError && <AppText style={styles.error}>{serverError}</AppText>}
      <Input label="عنوان التقييم" value={title} onChangeText={setTitle} error={errors.title} placeholder="ملخص تجربتك" maxLength={200} />
      <Input
        label="تفاصيل التقييم"
        value={body}
        onChangeText={setBody}
        error={errors.body}
        placeholder="شارك تجربتك مع هذا المنتج..."
        multiline
        maxLength={2000}
        style={{ minHeight: 90, textAlignVertical: 'top' }}
      />

      <View style={styles.formButtons}>
        <Button title="نشر التقييم" loading={create.isPending} disabled={eligible.length === 0} onPress={submit} style={{ flex: 1 }} />
        <Button title="إلغاء" variant="outline" onPress={onDone} />
      </View>
    </View>
  );
}

function ReviewRow({ review, productId }: { review: Review; productId: string }) {
  useTheme();
  const signedIn = useSessionStore((st) => st.signedIn);
  const helpful = useMarkHelpful(productId);
  const voted = !!(review.isCurrentUserVotedHelpful ?? review.isHelpful);
  const name = review.userFullName || 'مستخدم';

  const vote = () => {
    if (!signedIn) return router.push('/login');
    helpful.mutate({ id: review.id, helpful: !voted }, { onError: (e) => toast.error((e as ApiError).message || 'تعذّر تسجيل تصويتك') });
  };

  return (
    <View style={styles.review}>
      <View style={styles.reviewHead}>
        <View style={styles.avatar}>
          <AppText weight="bold" style={{ color: colors.white, fontSize: 16 }}>
            {name.charAt(0)}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText weight="bold" numberOfLines={1}>
            {name}
          </AppText>
          <StarRating value={review.rating} size={16} />
        </View>
        <AppText muted style={styles.small}>
          {timeAgoAr(review.createdAt)}
        </AppText>
      </View>
      <View style={styles.reviewBox}>
        {!!review.title && (
          <AppText weight="bold" style={{ fontSize: 14 }}>
            {review.title}
          </AppText>
        )}
        {(!!review.body || !review.title) && <AppText style={styles.body}>{review.body || '—'}</AppText>}
      </View>
      {!!review.vendorReply && (
        <View style={styles.reply}>
          <AppText weight="bold" style={[styles.small, { color: colors.primary }]}>
            رد المتجر
          </AppText>
          <AppText style={styles.small}>{review.vendorReply}</AppText>
        </View>
      )}
      <Pressable style={[styles.helpful, voted && { borderColor: colors.primary }]} onPress={vote} disabled={helpful.isPending} accessibilityRole="button">
        <Ionicons name={voted ? 'thumbs-up' : 'thumbs-up-outline'} size={14} color={voted ? colors.primary : colors.textMuted} />
        <AppText weight="medium" style={{ fontSize: 12, color: voted ? colors.primary : tc('#374151') }}>
          مراجعة مفيدة{review.helpfulCount > 0 ? ` (${review.helpfulCount})` : ''}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = createStyles(() => ({
  container: { gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 18 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.border },
  summary: { alignItems: 'center', gap: 4, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.background },
  average: { fontSize: 52, lineHeight: 64 },
  bars: { alignSelf: 'stretch', gap: 6, marginTop: spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barLabel: { width: 12, fontSize: 12 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: '#F59E0B' },
  barCount: { width: 24, fontSize: 12, textAlign: 'left' },
  sort: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border },
  empty: { alignItems: 'center', gap: 2, paddingVertical: spacing.lg },
  reviewedNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: radius.xl, borderWidth: 1, borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  writeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 52, borderRadius: radius.xl, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.placeholder },
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.xl, backgroundColor: brand.surfaceMuted },
  formTitle: { fontSize: 20, textAlign: 'center', marginBottom: spacing.xs },
  warning: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  warningText: { color: '#92400E', fontSize: 14 },
  orderOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  orderOptionActive: { borderColor: colors.primary },
  formButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  error: { color: colors.errorDark, fontSize: 13 },
  review: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, gap: 12 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  reviewBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, minHeight: 72, gap: 4 },
  helpful: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  viewAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: radius.full, borderWidth: 1.5, borderColor: '#C7D2FE' },
  body: { fontSize: 14, lineHeight: 22 },
  small: { fontSize: 12 },
  reply: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, gap: 2, marginTop: 4 },
}));
