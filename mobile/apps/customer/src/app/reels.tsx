import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchReels,
  fetchStoreFeed,
  mergeFreshReels,
  refreshReels,
  type SocialFeed,
  type SocialItem,
  type SocialReelsPage,
} from '@wasit/shared';
import { ReelsViewer } from '../components/ReelsViewer';

const PAGE_SIZE = 10;
const KEY = ['social-reels'];

// /reels            ← ريلز: فيديوهات وصور كل المتاجر المربوطة (تيك توك وإنستغرام وفيسبوك) بالأحدث
// /reels?vendor=ID&start=ITEM ← منشورات متجر واحد، تبدأ من المنشور الذي ضُغط عليه في صفحة المتجر
// /reels?mock=1     ← (نسخة التطوير فقط) بيانات وهمية لتجربة الشاشة دون حسابات مربوطة
export default function ReelsScreen() {
  const { mock, vendor, start } = useLocalSearchParams<{ mock?: string; vendor?: string; start?: string }>();
  const useMock = __DEV__ && mock === '1';
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (vendor) return <StoreReels vendorId={vendor} startId={start} useMock={useMock} onClose={close} />;
  return <AllReels useMock={useMock} onClose={close} />;
}

function AllReels({ useMock, onClose }: { useMock: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: useMock ? ['social-reels-mock'] : KEY,
    queryFn: ({ pageParam }) => (useMock ? require('../dev/mockReels').MOCK_REELS : fetchReels(pageParam, PAGE_SIZE)),
    initialPageParam: 1,
    getNextPageParam: (last: SocialReelsPage) => (last?.hasMore ? last.page + 1 : undefined),
    staleTime: 30 * 1000,
  });
  const reels: SocialItem[] = data?.pages.flatMap((p) => p?.items ?? []) ?? [];

  // جلب الجديد من المنصات: عند فتح الشاشة وعند السحب من أول فيديو
  const refresh = useCallback(async () => {
    if (useMock) return;
    setRefreshing(true);
    try {
      const first = await refreshReels(PAGE_SIZE);
      if (first?.items) queryClient.setQueryData(KEY, (old: any) => mergeFreshReels(old, first));
    } catch {
      // تبقى آخر نسخة محفوظة
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, useMock]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ReelsViewer
      items={reels}
      isLoading={isLoading}
      isError={isError}
      emptyText="ستظهر هنا فيديوهات المتاجر عند نشرها"
      onRetry={() => refetch()}
      onClose={onClose}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      onRefresh={refresh}
      refreshing={refreshing}
    />
  );
}

function StoreReels({ vendorId, startId, useMock, onClose }: { vendorId: string; startId?: string; useMock: boolean; onClose: () => void }) {
  // نفس مفتاح صفحة المتجر: المنشورات محمَّلة أصلاً فيفتح العارض فوراً
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: useMock ? ['social-store-feed-mock'] : ['social-store-feed', vendorId],
    queryFn: (): Promise<SocialFeed> => (useMock ? Promise.resolve(require('../dev/mockReels').MOCK_REELS) : fetchStoreFeed(vendorId)),
    staleTime: 5 * 60 * 1000,
  });
  const items = useMemo(() => (data?.items ?? []).filter((i) => !i.isHidden), [data]);
  const startIndex = Math.max(0, items.findIndex((i) => i.id === startId));

  return (
    <ReelsViewer
      // يُعاد بناء العارض إن تغيّر المنشور المطلوب أو وصلت البيانات بعد التحميل
      key={`${startId}-${items.length > 0}`}
      items={items}
      initialIndex={startIndex}
      title="المنشورات"
      isLoading={isLoading}
      isError={isError}
      emptyText="لا توجد منشورات لهذا المتجر"
      onRetry={() => refetch()}
      onClose={onClose}
    />
  );
}
