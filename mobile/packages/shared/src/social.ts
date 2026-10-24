import { api } from './api';
import { API_ENDPOINTS } from './endpoints';

// منشور من حسابات التواصل للمتجر (تيك توك / إنستغرام / فيسبوك)
export interface SocialItem {
  id: string;
  externalId?: string;
  platform: 'tiktok' | 'instagram' | 'facebook' | string;
  mediaType: 'video' | 'image' | 'carousel' | string;
  title?: string | null;
  coverImageUrl?: string | null;
  shareUrl?: string | null;
  // تيك توك: رابط مشغّل iframe. إنستغرام/فيسبوك: ملف الفيديو المباشر وعناصر الألبوم
  embedLink?: string | null;
  videoUrl?: string | null;
  children?: SocialChild[];
  durationSeconds?: number | null;
  store?: { id: string; name?: string | null; nameAr?: string | null; logoUrl?: string | null } | null;
  viewCount?: number | null;
  likeCount?: number | null;
  isHidden?: boolean;
  product?: {
    id: string;
    name?: string | null;
    nameAr?: string | null;
    price: number;
    originalPrice?: number | null;
    primaryImageUrl?: string | null;
    isAvailable: boolean;
  } | null;
}

export interface SocialChild {
  mediaType: 'image' | 'video' | string;
  url?: string | null;
  thumbnailUrl?: string | null;
}

export interface SocialReelsPage {
  items: SocialItem[];
  page: number;
  hasMore: boolean;
}

export interface SocialFeed {
  items: SocialItem[];
  accounts?: { platform: string }[];
}

export const fetchStoreFeed = async (vendorId: string): Promise<SocialFeed> => {
  const res = await api.get(API_ENDPOINTS.SOCIAL.STORE_FEED(vendorId));
  return res.data?.data ?? res.data ?? { items: [] };
};

// الخادم يحدّ تكرار المزامنة لكل متجر، فالاستدعاء آمن
export const refreshStoreFeed = async (vendorId: string): Promise<SocialFeed> => {
  const res = await api.post(API_ENDPOINTS.SOCIAL.STORE_FEED_REFRESH(vendorId));
  return res.data?.data ?? res.data ?? { items: [] };
};

// 1250 ← 1.2K
export const compactCount = (n?: number | null): string => {
  if (n == null) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
};

export const fetchReels = async (page: number, pageSize = 10): Promise<SocialReelsPage> => {
  const res = await api.get(API_ENDPOINTS.SOCIAL.REELS, { params: { page, pageSize } });
  return res.data?.data ?? res.data ?? { items: [], page, hasMore: false };
};

// يجلب الجديد من المنصات؛ الخادم يحدّ التكرار فالاستدعاء آمن
export const refreshReels = async (pageSize = 10): Promise<SocialReelsPage> => {
  const res = await api.post(API_ENDPOINTS.SOCIAL.REELS_REFRESH, null, { params: { pageSize } });
  return res.data?.data ?? res.data ?? { items: [], page: 1, hasMore: false };
};

// يضيف الجديد في الأعلى فقط ويُبقي القائمة المحمَّلة كما هي (لا تنزاح الفيديوهات ولا تُعاد المشغّلات)
export const mergeFreshReels = (
  old: { pages: SocialReelsPage[]; pageParams: unknown[] } | undefined,
  first: SocialReelsPage,
) => {
  if (!old?.pages?.length) return { pages: [first], pageParams: [1] };
  const known = new Set(old.pages.flatMap((p) => (p?.items ?? []).map((v) => v.id)));
  const fresh = first.items.filter((v) => !known.has(v.id));
  if (!fresh.length) return old;
  const [head, ...rest] = old.pages;
  return { ...old, pages: [{ ...head, items: [...fresh, ...(head.items ?? [])] }, ...rest] };
};

// تيك توك يُعرض بمشغّله الرسمي (WebView)، والباقي وسائط مباشرة
export const isNativeReel = (item: SocialItem): boolean => item.platform !== 'tiktok';
export const reelHasPlayer = (item: SocialItem): boolean =>
  !isNativeReel(item) || (item.mediaType === 'video' && !!item.videoUrl);

// مشغّل تيك توك الرسمي بلا أدواته (نفس معاملات الويب)
export const tiktokPlayerUrl = (item: SocialItem): string => {
  const url = new URL(item.embedLink || `https://www.tiktok.com/player/v1/${item.externalId}`);
  const set: Record<string, string> = {
    autoplay: '1', loop: '1', rel: '0', controls: '0', progress_bar: '0', play_button: '0',
    volume_control: '0', fullscreen_button: '0', timestamp: '0', description: '0',
    music_info: '0', native_context_menu: '0', closed_caption: '0',
  };
  for (const [k, v] of Object.entries(set)) url.searchParams.set(k, v);
  return url.toString();
};
