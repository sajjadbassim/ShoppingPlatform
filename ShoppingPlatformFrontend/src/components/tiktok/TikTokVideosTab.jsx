import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ReelsGrid, ReelTile } from './ReelsGrid'
import TikTokFeedViewer from './TikTokFeedViewer'

/**
 * تبويب محتوى حسابات التواصل (تيك توك + إنستغرام): شبكة الأغلفة، والضغط يفتح العارض بملء الشاشة
 */
const TikTokVideosTab = ({ account, videos, refreshing = false }) => {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <div>
      {/* تحديث المحتوى من المنصات — بدون عرض اسم الحساب أو زر المتابعة */}
      {refreshing && (
        <p className="flex items-center gap-1.5 text-xs text-primary px-4 py-2 sm:px-0 sm:pt-0">
          <RefreshCw size={12} className="animate-spin" />جاري تحديث المنشورات...
        </p>
      )}

      {/* الشبكة — بأسلوب صفحة الحساب في تيك توك/إنستغرام */}
      <ReelsGrid>
        {videos.map((v, i) => <ReelTile key={v.id} video={v} onClick={() => setOpenIndex(i)} />)}
      </ReelsGrid>

      {openIndex !== null && (
        <TikTokFeedViewer videos={videos} startIndex={openIndex} account={account} onClose={() => setOpenIndex(null)} />
      )}
    </div>
  )
}

export default TikTokVideosTab
