import { countHashtags, isVideoUrl, publishedPlatformsByProduct, requestFailure, type SocialPost } from './socialPublish';

const post = (over: Partial<SocialPost>): SocialPost => ({ id: '1', caption: '', media: [], createdAt: '', platform: 'instagram', status: 'PUBLISHED', ...over });

describe('socialPublish', () => {
  it('يعدّ الوسوم العربية واللاتينية', () => {
    expect(countHashtags('عرض #جديد و #sale_2026 و # فارغ')).toBe(2);
  });

  it('يميّز الفيديو من الرابط', () => {
    expect(isVideoUrl('/uploads/a.MP4?x=1')).toBe(true);
    expect(isVideoUrl('/uploads/a.jpg')).toBe(false);
    expect(isVideoUrl(null)).toBe(false);
  });

  it('يجمع المنصات التي نُشر عليها كل منتج (المنشور فقط)', () => {
    const map = publishedPlatformsByProduct([
      post({ productId: 'p1', platform: 'instagram' }),
      post({ productId: 'p1', platform: 'tiktok' }),
      post({ productId: 'p1', platform: 'tiktok' }),
      post({ productId: 'p2', status: 'SCHEDULED' }),
      post({ productId: undefined }),
    ]);
    expect(map).toEqual({ p1: ['instagram', 'tiktok'] });
  });

  it('فشل الطلب يصير نتيجة فاشلة لتلك المنصة', () => {
    const r = requestFailure('tiktok', new Error('انقطع الاتصال'));
    expect(r).toMatchObject({ platform: 'tiktok', status: 'FAILED', requestFailed: true, error: 'انقطع الاتصال' });
  });
});

import { filterFeed, sortFeedNewestFirst, type FeedItem } from './socialPublish';

const feed = (over: Partial<FeedItem>): FeedItem => ({ id: 'x', platform: 'instagram', mediaType: 'image', isHidden: false, ...over });

describe('منشورات الحسابات المربوطة', () => {
  const items = [
    feed({ id: 'a', platform: 'instagram', publishedAt: '2026-10-01T00:00:00Z' }),
    feed({ id: 'b', platform: 'tiktok', mediaType: 'video', isHidden: true, publishedAt: '2026-10-03T00:00:00Z' }),
    feed({ id: 'c', platform: 'tiktok', publishedAt: '2026-10-02T00:00:00Z', product: { id: 'p', price: 1, isAvailable: true } }),
    feed({ id: 'd', platform: 'facebook' }),
  ];

  it('يرتّب الأحدث أولاً ويضع بلا تاريخ في النهاية', () => {
    expect(sortFeedNewestFirst(items).map((i) => i.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('يرشّح بالمنصة والحالة معاً', () => {
    expect(filterFeed(items, 'tiktok', 'all').map((i) => i.id)).toEqual(['b', 'c']);
    expect(filterFeed(items, 'all', 'hidden').map((i) => i.id)).toEqual(['b']);
    expect(filterFeed(items, 'all', 'visible')).toHaveLength(3);
    expect(filterFeed(items, 'all', 'linked').map((i) => i.id)).toEqual(['c']);
  });
});
