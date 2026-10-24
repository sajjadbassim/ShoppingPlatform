import type { SocialReelsPage } from '@wasit/shared';

// بيانات وهمية لتجربة الريلز دون حسابات مربوطة: تُفتح بـ /reels?mock=1 في نسخة التطوير فقط
const FLOWER = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

export const MOCK_REELS: SocialReelsPage = {
  page: 1,
  hasMore: false,
  items: [
    {
      id: 'm1', platform: 'instagram', mediaType: 'video', title: 'فيديو إنستغرام تجريبي (ملف mp4 مباشر)',
      videoUrl: FLOWER, coverImageUrl: 'https://picsum.photos/seed/r1/720/1280',
      shareUrl: 'https://www.instagram.com/', likeCount: 1250,
      store: { id: 's1', nameAr: 'متجر تجريبي', logoUrl: null },
    },
    {
      id: 'm2', platform: 'tiktok', mediaType: 'video', externalId: '6718335390845095173',
      coverImageUrl: 'https://picsum.photos/seed/r2/720/1280', shareUrl: 'https://www.tiktok.com/',
      store: { id: 's1', nameAr: 'متجر تجريبي', logoUrl: null },
    },
    {
      id: 'm3', platform: 'instagram', mediaType: 'image', title: 'صورة إنستغرام تجريبية',
      coverImageUrl: 'https://picsum.photos/seed/r3/1080/1350', shareUrl: 'https://www.instagram.com/',
    },
    {
      id: 'm4', platform: 'facebook', mediaType: 'carousel', title: 'ألبوم فيسبوك تجريبي',
      coverImageUrl: 'https://picsum.photos/seed/r4/1080/1080', shareUrl: 'https://www.facebook.com/',
      children: [
        { mediaType: 'image', url: 'https://picsum.photos/seed/r4/1080/1080' },
        { mediaType: 'image', url: 'https://picsum.photos/seed/r5/1080/1080' },
        { mediaType: 'video', url: FLOWER, thumbnailUrl: 'https://picsum.photos/seed/r6/1080/1080' },
      ],
    },
    {
      id: 'm5', platform: 'instagram', mediaType: 'video', title: 'فيديو ثانٍ',
      videoUrl: FLOWER, coverImageUrl: 'https://picsum.photos/seed/r7/720/1280',
      shareUrl: 'https://www.instagram.com/',
    },
  ],
};
