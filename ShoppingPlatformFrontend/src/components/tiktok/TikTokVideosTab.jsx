import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ReelsGrid, ReelTile } from './ReelsGrid'
import TikTokFeedViewer from './TikTokFeedViewer'

/**
 * تبويب فيديوهات تيك توك: رأس الحساب + شبكة الأغلفة، والضغط يفتح العارض بملء الشاشة
 */
const TikTokVideosTab = ({ account, videos, refreshing = false }) => {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <div>
      {/* تحديث الفيديوهات من تيك توك — بدون عرض اسم الحساب أو زر المتابعة */}
      {refreshing && (
        <p className="flex items-center gap-1.5 text-xs text-primary px-4 py-2 sm:px-0 sm:pt-0">
          <RefreshCw size={12} className="animate-spin" />جاري تحديث الفيديوهات...
        </p>
      )}

      {/* الشبكة — بأسلوب صفحة الحساب في تيك توك */}
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
