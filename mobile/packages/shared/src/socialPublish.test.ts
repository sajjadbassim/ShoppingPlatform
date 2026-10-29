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
