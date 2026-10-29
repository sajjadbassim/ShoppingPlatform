import { api } from './api';
import { API_ENDPOINTS } from './endpoints';
import type { PickedImage } from './upload';
import { appendImages } from './upload';

// نشر المنتجات على حسابات التواصل وجدولتها (InstagramController وTikTokController وSocialPublishController).
// الأشكال مطابقة لـ DTOs الخادم؛ والمنطق مطابق لصفحة VendorPublish في الويب

const unwrap = <T>(res: { data?: { data?: T } | T }): T => ((res.data as { data?: T })?.data ?? res.data) as T;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 10 * 60 * 1000 };
// النشر يتم داخل الطلب (تجهيز الصور + انتظار المنصة) فقد يتجاوز المهلة الافتراضية
const LONG = { timeout: 120000 };

export type PublishPlatform = 'instagram' | 'tiktok';

export const PUBLISH_LIMITS = { maxMedia: 10, maxCaption: 2200, maxHashtags: 30, scheduleDays: 30, maxVideoMb: 100, maxImageMb: 15 } as const;

export interface InstagramPublishOptions {
  publishingEnabled: boolean;
  connected: boolean;
  needsReconnect: boolean;
  canPublish: boolean;
  username?: string | null;
  profilePictureUrl?: string | null;
  productId: string;
  productName: string;
  storeName?: string | null;
  storeLogoUrl?: string | null;
  images: string[];
  suggestedCaption: string;
  quotaUsage?: number | null;
  quotaTotal?: number | null;
}

export interface TikTokStatus {
  publishingEnabled: boolean;
  connected: boolean;
  needsReconnect: boolean;
  canPublish: boolean;
  account?: { username?: string | null; displayName?: string | null; avatarUrl?: string | null } | null;
}

export type TikTokPrivacy = 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY';

export const TIKTOK_PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: 'الجميع',
  MUTUAL_FOLLOW_FRIENDS: 'الأصدقاء',
  FOLLOWER_OF_CREATOR: 'متابعوك',
  SELF_ONLY: 'أنا فقط',
};

export interface TikTokPublishOptions {
  nickname?: string | null;
  privacyOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoDurationSeconds: number;
}

export interface TikTokSettings {
  privacy: string;
  comment: boolean;
  duet: boolean;
  stitch: boolean;
  promotes: boolean;
  consent: boolean;
}

export type PostStatus = 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED' | string;

export interface SocialPost {
  id: string;
  productId?: string | null;
  productName?: string | null;
  caption: string;
  // إنستغرام: images، تيك توك: media — نوحّدهما في media
  media: string[];
  status: PostStatus;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  permalink?: string | null;
  privacyLevel?: string | null;
  error?: string | null;
  createdAt: string;
  platform: PublishPlatform;
  // يُملأ محلياً حين يفشل الطلب نفسه قبل أن يصل إلى المنصة
  requestFailed?: boolean;
}

type RawPost = Omit<SocialPost, 'media' | 'platform'> & { images?: string[]; media?: string[] };
const normalize = (p: RawPost, platform: PublishPlatform): SocialPost => ({ ...p, media: p.media ?? p.images ?? [], platform });

export const isVideoUrl = (url?: string | null) => /\.(mp4|mov)(\?|$)/i.test(url || '');
export const countHashtags = (s: string) => (s.match(/#[\p{L}\p{N}_]+/gu) || []).length;

// ===== الخيارات والحالة =====
export const fetchInstagramPublishOptions = async (productId: string): Promise<InstagramPublishOptions> =>
  unwrap(await api.get(API_ENDPOINTS.INSTAGRAM.PUBLISH_OPTIONS, { params: { productId } }));

export const fetchTikTokStatus = async (): Promise<TikTokStatus> => unwrap(await api.get(API_ENDPOINTS.TIKTOK.STATUS));

export const fetchTikTokPublishOptions = async (productId: string): Promise<TikTokPublishOptions> =>
  unwrap(await api.get(API_ENDPOINTS.TIKTOK.PUBLISH_OPTIONS, { params: { productId } }));

// ===== رفع وسائط من المعرض =====
export interface PickedMedia extends PickedImage {
  video: boolean;
  durationSec?: number | null;
  sizeBytes?: number | null;
}

export const uploadPublishMedia = async (file: PickedMedia): Promise<string> => {
  const fd = new FormData();
  appendImages(fd, 'file', [file]);
  const res = unwrap<{ url: string }>(await api.post(API_ENDPOINTS.SOCIAL.PUBLISH_UPLOAD, fd, MULTIPART));
  return res.url;
};

// ===== إنشاء المنشورات =====
export interface PublishPayload {
  productId: string;
  media: string[];
  caption: string;
  // null = النشر الآن
  scheduledAt: string | null;
}

export const createInstagramPost = async (p: PublishPayload): Promise<SocialPost> =>
  normalize(unwrap(await api.post(API_ENDPOINTS.INSTAGRAM.POSTS, { productId: p.productId, images: p.media, caption: p.caption, scheduledAt: p.scheduledAt }, LONG)), 'instagram');

export const createTikTokPost = async (p: PublishPayload, tt: TikTokSettings): Promise<SocialPost> =>
  normalize(
    unwrap(await api.post(API_ENDPOINTS.TIKTOK.POSTS, {
      productId: p.productId,
      media: p.media,
      caption: p.caption,
      privacyLevel: tt.privacy,
      allowComment: tt.comment,
      allowDuet: tt.duet,
      allowStitch: tt.stitch,
      promotesOwnBusiness: tt.promotes,
      consent: tt.consent,
      scheduledAt: p.scheduledAt,
    }, LONG)),
    'tiktok',
  );

// فشل الطلب نفسه (تحقق، شبكة) يُعرض كنتيجة فاشلة لتلك المنصة فقط
export const requestFailure = (platform: PublishPlatform, err: unknown): SocialPost => ({
  id: '', caption: '', media: [], createdAt: '', platform, status: 'FAILED', requestFailed: true,
  error: (err as { message?: string })?.message || 'تعذّر الإرسال',
});

// ===== السجل والإجراءات =====
export const fetchSocialPosts = async (platform: PublishPlatform): Promise<SocialPost[]> => {
  const url = platform === 'instagram' ? API_ENDPOINTS.INSTAGRAM.POSTS : API_ENDPOINTS.TIKTOK.POSTS;
  const list = unwrap<RawPost[]>(await api.get(url)) ?? [];
  return list.map((p) => normalize(p, platform));
};

export const retrySocialPost = async (platform: PublishPlatform, id: string): Promise<SocialPost> => {
  const url = platform === 'instagram' ? API_ENDPOINTS.INSTAGRAM.POST_RETRY(id) : API_ENDPOINTS.TIKTOK.POST_RETRY(id);
  return normalize(unwrap(await api.post(url, {}, LONG)), platform);
};

export const cancelSocialPost = async (platform: PublishPlatform, id: string): Promise<void> => {
  await api.post(platform === 'instagram' ? API_ENDPOINTS.INSTAGRAM.POST_CANCEL(id) : API_ENDPOINTS.TIKTOK.POST_CANCEL(id), {});
};

// المنتجات التي نُشرت فعلاً ← المنصات (لتنبيه «نُشر سابقاً»)
export const publishedPlatformsByProduct = (posts: SocialPost[]): Record<string, PublishPlatform[]> => {
  const map: Record<string, PublishPlatform[]> = {};
  for (const p of posts) {
    if (p.status !== 'PUBLISHED' || !p.productId) continue;
    const list = (map[p.productId] ??= []);
    if (!list.includes(p.platform)) list.push(p.platform);
  }
  return map;
};

// ===== منشورات الحسابات المربوطة (ما نُشر سابقاً على المنصات، المزامَن إلى المتجر) =====
export type FeedPlatform = 'instagram' | 'tiktok' | 'facebook';

export interface FeedItem {
  id: string;
  platform: FeedPlatform;
  mediaType: 'video' | 'image' | 'carousel' | string;
  title?: string | null;
  coverImageUrl?: string | null;
  shareUrl?: string | null;
  durationSeconds?: number | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentsCount?: number | null;
  publishedAt?: string | null;
  isHidden: boolean;
  // منشور نُشر بخصوصية خاصة على تيك توك: للقراءة فقط
  platformOnly?: boolean;
  privacyLevel?: string | null;
  product?: { id: string; name?: string | null; nameAr?: string | null; price: number; primaryImageUrl?: string | null; isAvailable: boolean } | null;
}

const FEED_URLS: Record<FeedPlatform, { list: string; item: (id: string) => string }> = {
  instagram: { list: API_ENDPOINTS.INSTAGRAM.MEDIA, item: API_ENDPOINTS.INSTAGRAM.MEDIA_ITEM },
  tiktok: { list: API_ENDPOINTS.TIKTOK.VIDEOS, item: API_ENDPOINTS.TIKTOK.VIDEO },
  facebook: { list: API_ENDPOINTS.FACEBOOK.MEDIA, item: API_ENDPOINTS.FACEBOOK.MEDIA_ITEM },
};

// عناصر تيك توك لا تحمل المنصة ولا النوع، فنضيفهما ليعمل العرض المشترك
const normalizeFeed = (platform: FeedPlatform, raw: Partial<FeedItem>): FeedItem =>
  ({ ...raw, platform, mediaType: platform === 'tiktok' ? 'video' : raw.mediaType ?? 'image', isHidden: !!raw.isHidden }) as FeedItem;

export const fetchFeedItems = async (platform: FeedPlatform): Promise<FeedItem[]> =>
  (unwrap<Partial<FeedItem>[]>(await api.get(FEED_URLS[platform].list)) ?? []).map((r) => normalizeFeed(platform, r));

// الحقول غير المرسلة لا تتغير. removeProduct=true يفك ربط المنتج
export const updateFeedItem = async (platform: FeedPlatform, id: string, patch: { isHidden?: boolean; productId?: string; removeProduct?: boolean }): Promise<FeedItem> =>
  normalizeFeed(platform, unwrap(await api.patch(FEED_URLS[platform].item(id), patch)));

export const FEED_FILTERS = ['all', 'visible', 'hidden', 'linked'] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];

export const filterFeed = (items: FeedItem[], platform: FeedPlatform | 'all', filter: FeedFilter): FeedItem[] =>
  items.filter((i) => (platform === 'all' || i.platform === platform) && (filter === 'visible' ? !i.isHidden : filter === 'hidden' ? i.isHidden : filter === 'linked' ? !!i.product : true));

export const sortFeedNewestFirst = (items: FeedItem[]): FeedItem[] =>
  [...items].sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
