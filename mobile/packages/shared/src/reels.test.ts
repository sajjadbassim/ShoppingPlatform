import { isNativeReel, mergeFreshReels, reelHasPlayer, tiktokPlayerUrl, type SocialItem, type SocialReelsPage } from './social';

const item = (over: Partial<SocialItem>): SocialItem => ({ id: 'a', platform: 'tiktok', mediaType: 'video', ...over });
const page = (ids: string[], p = 1): SocialReelsPage => ({ items: ids.map((id) => item({ id })), page: p, hasMore: false });

describe('reels', () => {
  it('تيك توك بمشغّله، وإنستغرام فيديو بالرابط المباشر فقط', () => {
    expect(isNativeReel(item({ platform: 'tiktok' }))).toBe(false);
    expect(reelHasPlayer(item({ platform: 'tiktok' }))).toBe(true);
    expect(reelHasPlayer(item({ platform: 'instagram', videoUrl: 'https://x/v.mp4' }))).toBe(true);
    expect(reelHasPlayer(item({ platform: 'instagram' }))).toBe(false); // موسيقى محمية: بلا رابط
    expect(reelHasPlayer(item({ platform: 'instagram', mediaType: 'image', videoUrl: 'https://x/v.mp4' }))).toBe(false);
  });

  it('رابط مشغّل تيك توك يُخفي الأدوات', () => {
    const url = new URL(tiktokPlayerUrl(item({ externalId: '123' })));
    expect(url.pathname).toBe('/player/v1/123');
    expect(url.searchParams.get('controls')).toBe('0');
    expect(url.searchParams.get('autoplay')).toBe('1');
    const custom = new URL(tiktokPlayerUrl(item({ embedLink: 'https://www.tiktok.com/player/v1/9?x=1' })));
    expect(custom.searchParams.get('x')).toBe('1');
    expect(custom.searchParams.get('loop')).toBe('1');
  });

  it('دمج الجديد يضيف غير المعروف في الأعلى ويُبقي الباقي', () => {
    const old = { pages: [page(['b', 'c']), page(['d'], 2)], pageParams: [1, 2] };
    const merged = mergeFreshReels(old, page(['a', 'b']));
    expect(merged.pages[0].items.map((v) => v.id)).toEqual(['a', 'b', 'c']);
    expect(merged.pages[1].items.map((v) => v.id)).toEqual(['d']);
  });

  it('دمج بلا جديد يعيد النسخة نفسها، وبلا بيانات سابقة يبدأ بالصفحة', () => {
    const old = { pages: [page(['a'])], pageParams: [1] };
    expect(mergeFreshReels(old, page(['a']))).toBe(old);
    expect(mergeFreshReels(undefined, page(['a'])).pages).toHaveLength(1);
  });
});
