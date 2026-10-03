// src/pages/customer/ReelsPage.jsx
// تصفّح ريلز: فيديوهات تيك توك ومنشورات إنستغرام (فيديو وصور وألبومات) من كل المتاجر المربوطة، بملء الشاشة وتمرير عمودي
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Clapperboard, X } from 'lucide-react'
import { apiGet, apiPost } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import TikTokFeedViewer from '../../components/tiktok/TikTokFeedViewer'

const PAGE_SIZE = 10

const ReelsPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: ['social-reels'],
    queryFn: async ({ pageParam }) => {
      const r = await apiGet(API_ENDPOINTS.SOCIAL.REELS, { page: pageParam, pageSize: PAGE_SIZE })
      return r.data?.data ?? r.data
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last?.hasMore ? last.page + 1 : undefined),
    staleTime: 30 * 1000,
  })

  // جلب آخر الريلز المنشورة من المنصات: عند فتح الصفحة، وعند السحب للأسفل من أول فيديو
  const [refreshing, setRefreshing] = useState(false)
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const r = await apiPost(`${API_ENDPOINTS.SOCIAL.REELS_REFRESH}?pageSize=${PAGE_SIZE}`)
      const first = r.data?.data ?? r.data
      if (!first?.items) return
      // الجديد يُضاف في الأعلى فقط، والقائمة المحمَّلة تبقى كما هي (لا يُعاد تحميل المشغلات ولا تنزاح الفيديوهات)
      queryClient.setQueryData(['social-reels'], (old) => {
        if (!old?.pages?.length) return { pages: [first], pageParams: [1] }
        const known = new Set(old.pages.flatMap(p => (p?.items || []).map(v => v.id)))
        const fresh = first.items.filter(v => !known.has(v.id))
        if (!fresh.length) return old
        const [head, ...rest] = old.pages
        return { ...old, pages: [{ ...head, items: [...fresh, ...(head.items || [])] }, ...rest] }
      })
    } catch { /* تبقى آخر نسخة محفوظة */ }
    finally { setRefreshing(false) }
  }, [queryClient])
  useEffect(() => { refresh() }, [refresh])

  const reels = data?.pages.flatMap(p => p?.items || []) || []

  // الرجوع للصفحة السابقة، أو للرئيسية إن فُتحت الصفحة مباشرة
  const close = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))

  if (isLoading || isError || reels.length === 0) {
    return (
      <div className="fixed inset-0 z-[70] bg-black text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <button onClick={close} aria-label="إغلاق"
          className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
          <X size={22} />
        </button>
        {isLoading ? (
          <>
            <span className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
            <p className="text-sm text-white/70">جاري تحميل الريلز...</p>
          </>
        ) : (
          <>
            <Clapperboard size={44} className="text-white/60" />
            <p className="font-bold text-lg">{isError ? 'تعذّر تحميل الريلز' : 'لا توجد ريلز بعد'}</p>
            <p className="text-sm text-white/60">{isError ? 'تحقق من الاتصال وحاول مجدداً' : 'ستظهر هنا فيديوهات المتاجر عند نشرها'}</p>
            {isError && <button onClick={() => refetch()} className="h-10 px-5 rounded-full bg-white text-black font-bold text-sm">إعادة المحاولة</button>}
          </>
        )}
      </div>
    )
  }

  return (
    <TikTokFeedViewer
      videos={reels}
      standalone
      title="ريلز"
      onClose={close}
      onNearEnd={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }}
      onRefresh={refresh}
      refreshing={refreshing}
    />
  )
}

export default ReelsPage
