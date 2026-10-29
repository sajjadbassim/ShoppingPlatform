import { useMemo, useState } from 'react';
import { Linking, Pressable, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchFeedItems, fetchSocialStatus, filterFeed, formatDateTime, getImageUrl, sortFeedNewestFirst, syncSocial, updateFeedItem, productImageOf,
  type FeedFilter, type FeedItem, type FeedPlatform, type VendorProduct,
} from '@wasit/shared';
import { AppText, brand, colors, Input, useTheme } from '@wasit/ui';
import { useProducts } from '../../api/useVendor';
import { ActionButton, Card, Empty, FilterPills } from '../kit';
import { Sheet } from '../Sheet';
import { PLATFORM_ICON, PLATFORM_LABEL } from '../../lib/socialPosts';
import { toast } from '../../lib/toast';

const PLATFORMS: FeedPlatform[] = ['instagram', 'tiktok', 'facebook'];
const LABEL: Record<FeedPlatform, string> = { ...PLATFORM_LABEL, facebook: 'فيسبوك' };
const ICON: Record<FeedPlatform, React.ComponentProps<typeof Ionicons>['name']> = { ...PLATFORM_ICON, facebook: 'logo-facebook' };
const PAGE = 30;
const GAP = 4;
const COLS = 3;

const num = (n?: number | null) => (n == null ? null : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));

// ما نُشر سابقاً على الحسابات المربوطة (تُزامَن إلى المتجر): الكل أو بحسب المنصة، ظاهر أو مخفي أو مربوط بمنتج
export function FeedTab() {
  useTheme();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const tile = (width - 32 - GAP * (COLS - 1)) / COLS;

  const statuses = useQueries({ queries: PLATFORMS.map((p) => ({ queryKey: ['v-social', p], queryFn: () => fetchSocialStatus(p), retry: false })) });
  const connected = PLATFORMS.filter((_, i) => statuses[i].data?.connected);
  const feeds = useQueries({
    queries: PLATFORMS.map((p, i) => ({ queryKey: ['v-feed', p], queryFn: () => fetchFeedItems(p), enabled: !!statuses[i].data?.connected, retry: false })),
  });

  const [platform, setPlatform] = useState<FeedPlatform | 'all'>('all');
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<FeedItem | null>(null);
  const [linking, setLinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const products = useProducts();

  const all = useMemo(() => sortFeedNewestFirst(feeds.flatMap((f) => f.data ?? [])), [feeds.map((f) => f.dataUpdatedAt).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = platform !== 'all' && !connected.includes(platform) ? 'all' : platform;
  const inPlatform = filterFeed(all, active, 'all');
  const shown = filterFeed(all, active, filter);
  const count = (f: FeedFilter) => filterFeed(inPlatform, 'all', f).length;
  const loading = statuses.some((s) => s.isLoading) || feeds.some((f) => f.isLoading);
  const refreshing = feeds.some((f) => f.isRefetching);

  const refresh = () => {
    PLATFORMS.forEach((p) => queryClient.invalidateQueries({ queryKey: ['v-feed', p] }));
    PLATFORMS.forEach((p) => queryClient.invalidateQueries({ queryKey: ['v-social', p] }));
  };

  const syncAll = async () => {
    setSyncing(true);
    const res = await Promise.allSettled(connected.map((p) => syncSocial(p)));
    setSyncing(false);
    const failed = res.filter((r) => r.status === 'rejected').length;
    if (failed) toast.error(`تعذّرت مزامنة ${failed} من ${res.length} حسابات`);
    else toast.success('تمت المزامنة');
    refresh();
  };

  const patch = async (item: FeedItem, body: { isHidden?: boolean; productId?: string; removeProduct?: boolean }, ok: string) => {
    setBusy(true);
    try {
      const updated = await updateFeedItem(item.platform, item.id, body);
      queryClient.setQueryData<FeedItem[]>(['v-feed', item.platform], (old = []) => old.map((x) => (x.id === item.id ? { ...x, ...updated } : x)));
      setOpen((cur) => (cur && cur.id === item.id ? { ...cur, ...updated } : cur));
      setLinking(false);
      toast.success(ok);
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  const pickList = (products.data ?? []).filter((p) => !search.trim() || `${p.nameAr} ${p.name} ${p.sku ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 40);

  return (
    <>
      {connected.length > 0 && <ActionButton title={syncing ? 'جاري المزامنة...' : 'مزامنة الآن'} icon="sync-outline" tone="soft" compact onPress={syncAll} loading={syncing} />}
      {!loading && connected.length === 0 && <Empty icon="link-outline" text="لا توجد حسابات مربوطة. اربط حساباً من «ربط الحسابات» لتظهر منشوراتك هنا" />}

      {connected.length > 1 && (
        <FilterPills<FeedPlatform | 'all'>
          value={active}
          onChange={(v) => { setPlatform(v); setLimit(PAGE); }}
          options={[{ key: 'all', label: 'كل المنصات' }, ...connected.map((p) => ({ key: p, label: LABEL[p] }))]}
        />
      )}
      {all.length > 0 && (
        <FilterPills<FeedFilter>
          value={filter}
          onChange={(v) => { setFilter(v); setLimit(PAGE); }}
          options={[
            { key: 'all', label: 'الكل', count: count('all') },
            { key: 'visible', label: 'ظاهر', count: count('visible') },
            { key: 'hidden', label: 'مخفي', count: count('hidden') },
            { key: 'linked', label: 'مربوط بمنتج', count: count('linked') },
          ]}
        />
      )}

      {connected.length > 0 && !loading && all.length === 0 && <Empty icon="images-outline" text="لا منشورات بعد. اضغط «مزامنة» أو انشر على حسابك وستظهر هنا" />}
      {all.length > 0 && shown.length === 0 && <Empty icon="images-outline" text="لا منشورات في هذا التصنيف" />}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {shown.slice(0, limit).map((it) => (
          <Pressable key={`${it.platform}-${it.id}`} onPress={() => setOpen(it)} style={{ width: tile, height: tile * 1.3, borderRadius: 10, overflow: 'hidden', backgroundColor: brand.surfaceMuted }} accessibilityLabel={it.title || 'منشور'}>
            {it.coverImageUrl ? <Image source={{ uri: getImageUrl(it.coverImageUrl, 400) ?? it.coverImageUrl }} style={{ width: '100%', height: '100%', opacity: it.isHidden ? 0.35 : 1 }} contentFit="cover" /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="image-outline" size={26} color={colors.textMuted} /></View>}
            <View style={{ position: 'absolute', top: 5, start: 5, flexDirection: 'row', gap: 4 }}>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 3 }}><Ionicons name={ICON[it.platform]} size={13} color="#FFFFFF" /></View>
              {it.mediaType === 'video' && <View style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 3 }}><Ionicons name="play" size={13} color="#FFFFFF" /></View>}
              {it.mediaType === 'carousel' && <View style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 3 }}><Ionicons name="copy-outline" size={13} color="#FFFFFF" /></View>}
            </View>
            {it.isHidden && <View style={{ position: 'absolute', top: 5, end: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: 3 }}><Ionicons name="eye-off" size={13} color="#FFFFFF" /></View>}
            {!!it.product && (
              <View style={{ position: 'absolute', bottom: 5, start: 5, end: 5, backgroundColor: colors.primaryHover, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                <AppText weight="bold" numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 10.5, lineHeight: 16 }}>{it.product.nameAr || it.product.name}</AppText>
              </View>
            )}
          </Pressable>
        ))}
      </View>
      {shown.length > limit && <ActionButton title={`عرض المزيد (${shown.length - limit})`} tone="ghost" onPress={() => setLimit((l) => l + PAGE)} />}

      {/* تفاصيل المنشور */}
      <Sheet
        visible={!!open && !linking}
        onClose={() => setOpen(null)}
        title={open ? LABEL[open.platform] : ''}
        subtitle={open?.publishedAt ? `نُشر ${formatDateTime(open.publishedAt)}` : undefined}
        busy={busy}
      >
        {!!open && (
          <>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 96, height: 124, borderRadius: 12, overflow: 'hidden', backgroundColor: brand.surfaceMuted }}>
                {!!open.coverImageUrl && <Image source={{ uri: getImageUrl(open.coverImageUrl, 400) ?? open.coverImageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />}
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <AppText style={{ fontSize: 14, lineHeight: 22 }} numberOfLines={6}>{open.title || 'منشور بلا عنوان'}</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {num(open.viewCount) && <Stat icon="eye-outline" v={num(open.viewCount)!} />}
                  {num(open.likeCount) && <Stat icon="heart-outline" v={num(open.likeCount)!} />}
                  {num(open.commentsCount) && <Stat icon="chatbubble-outline" v={num(open.commentsCount)!} />}
                </View>
                {open.isHidden && <AppText style={{ fontSize: 12.5, color: '#8A5A00' }}>مخفي من متجرك</AppText>}
              </View>
            </View>
            {open.platformOnly ? (
              <AppText muted style={{ fontSize: 13, lineHeight: 22 }}>نُشر بخصوصية خاصة على تيك توك، فلا يمكن ربطه بمنتج أو عرضه في المتجر من هنا. اجعله عاماً من تطبيق تيك توك ليُزامَن تلقائياً.</AppText>
            ) : (
              <>
                {!!open.product && (
                  <Card pad={10}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {!!open.product.primaryImageUrl && <Image source={{ uri: getImageUrl(open.product.primaryImageUrl, 200) ?? open.product.primaryImageUrl }} style={{ width: 44, height: 44, borderRadius: 8 }} contentFit="cover" />}
                      <View style={{ flex: 1 }}>
                        <AppText muted style={{ fontSize: 12 }}>المنتج المربوط</AppText>
                        <AppText weight="bold" numberOfLines={2}>{open.product.nameAr || open.product.name}</AppText>
                      </View>
                    </View>
                  </Card>
                )}
                <ActionButton title={open.product ? 'تغيير المنتج المربوط' : 'ربط بمنتج'} icon="cube-outline" tone="soft" onPress={() => { setSearch(''); setLinking(true); }} />
                {!!open.product && <ActionButton title="فك ربط المنتج" tone="ghost" loading={busy} onPress={() => patch(open, { removeProduct: true }, 'تم فك الربط')} />}
                <ActionButton
                  title={open.isHidden ? 'إظهار في المتجر' : 'إخفاء من المتجر'}
                  icon={open.isHidden ? 'eye-outline' : 'eye-off-outline'}
                  tone="ghost"
                  loading={busy}
                  onPress={() => patch(open, { isHidden: !open.isHidden }, open.isHidden ? 'سيظهر في متجرك' : 'أُخفي من متجرك')}
                />
              </>
            )}
            {!!open.shareUrl && <ActionButton title={`فتح في ${LABEL[open.platform]}`} icon="open-outline" tone="ghost" onPress={() => Linking.openURL(open.shareUrl!)} />}
          </>
        )}
      </Sheet>

      {/* اختيار المنتج للربط */}
      <Sheet visible={!!open && linking} onClose={() => setLinking(false)} title="اختر المنتج" subtitle="يظهر زر «اشترِ الآن» على المنشور في متجرك" busy={busy}>
        <Input label="بحث" value={search} onChangeText={setSearch} placeholder="اسم المنتج أو الرمز" />
        {pickList.length === 0 && <AppText muted>{products.isLoading ? 'جاري التحميل...' : 'لا منتجات مطابقة'}</AppText>}
        {pickList.map((p: VendorProduct) => (
          <Pressable key={p.id} onPress={() => open && patch(open, { productId: p.id }, 'تم الربط')} disabled={busy} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.6 : 1 })}>
            <View style={{ width: 46, height: 46, borderRadius: 10, overflow: 'hidden', backgroundColor: brand.surfaceMuted }}>
              {!!productImageOf(p) && <Image source={{ uri: getImageUrl(productImageOf(p), 200) ?? undefined }} style={{ width: '100%', height: '100%' }} contentFit="cover" />}
            </View>
            <AppText weight="bold" numberOfLines={2} style={{ flex: 1 }}>{p.nameAr || p.name}</AppText>
            {open?.product?.id === p.id && <Ionicons name="checkmark-circle" size={20} color={colors.primaryHover} />}
          </Pressable>
        ))}
      </Sheet>
    </>
  );
}

function Stat({ icon, v }: { icon: React.ComponentProps<typeof Ionicons>['name']; v: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={15} color={colors.textMuted} />
      <AppText muted style={{ fontSize: 13 }}>{v}</AppText>
    </View>
  );
}
