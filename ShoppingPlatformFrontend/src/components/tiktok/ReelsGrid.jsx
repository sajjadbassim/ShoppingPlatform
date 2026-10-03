import { useState } from 'react'
import { Play, ShoppingBag, EyeOff, Heart, Copy, Clapperboard } from 'lucide-react'
import { compactCount } from './TikTokLogo'
import PlatformLogo from '../social/PlatformLogo'

// خلية بأسلوب صفحة الحساب في تيك توك/إنستغرام: 3:4، بلا زوايا، العدد في الأسفل وشعار المنصة.
// العنصر من تيك توك أو إنستغرام (platform)، وقد يكون فيديو أو صورة أو ألبوم (mediaType)
export const ReelTile = ({ video, onClick, dimmed = false }) => {
  const [failed, setFailed] = useState(false)
  const isInstagram = video.platform === 'instagram'
  // إنستغرام لا يعطي عدد المشاهدات بالصلاحية الأساسية — نعرض الإعجابات
  const showLikes = isInstagram || video.viewCount == null
  return (
    <button type="button" onClick={onClick} aria-label={video.title || 'فتح المنشور'}
      className="group relative aspect-[3/4] w-full overflow-hidden bg-gray-900 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white">
      {video.coverImageUrl && !failed ? (
        <img src={video.coverImageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}
          className={`absolute inset-0 w-full h-full object-cover transition duration-300 group-hover:scale-105 ${dimmed ? 'opacity-40 grayscale' : ''}`} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center"><PlatformLogo platform={video.platform} className="w-9 h-9 opacity-50" /></span>
      )}

      {/* تظليل خفيف في الأسفل ليظهر العدد على أي غلاف */}
      <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />

      <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 text-[12px] sm:text-sm text-white font-semibold drop-shadow" dir="ltr">
        {showLikes
          ? <><Heart size={13} strokeWidth={2.5} />{compactCount(video.likeCount)}</>
          : <><Play size={13} strokeWidth={2.5} />{compactCount(video.viewCount)}</>}
      </span>

      <span className="absolute bottom-1.5 right-1.5 drop-shadow">
        <PlatformLogo platform={video.platform} className="w-4 h-4" />
      </span>

      {video.product && (
        <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-white/90 text-gray-900 flex items-center justify-center shadow-sm" title="مرتبط بمنتج">
          <ShoppingBag size={13} />
        </span>
      )}

      {dimmed ? (
        <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold">
          <EyeOff size={11} />مخفي
        </span>
      ) : isInstagram && video.mediaType !== 'image' && (
        // نوع المنشور كما في شبكة إنستغرام: ألبوم أو فيديو
        <span className="absolute top-1.5 left-1.5 text-white drop-shadow" title={video.mediaType === 'carousel' ? 'ألبوم' : 'فيديو'}>
          {video.mediaType === 'carousel' ? <Copy size={15} strokeWidth={2.5} /> : <Clapperboard size={15} strokeWidth={2.5} />}
        </span>
      )}
    </button>
  )
}

// شبكة 3 أعمدة بفواصل رفيعة (تتوسع على الشاشات الكبيرة)
export const ReelsGrid = ({ children, className = '' }) => (
  <div className={`grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-[2px] sm:gap-1 ${className}`}>
    {children}
  </div>
)

export default ReelsGrid
