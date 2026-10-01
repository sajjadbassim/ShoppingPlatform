import { useState } from 'react'
import { Play, ShoppingBag, EyeOff } from 'lucide-react'
import TikTokLogo, { compactCount } from './TikTokLogo'

// خلية فيديو بأسلوب صفحة الحساب في تيك توك/إنستغرام: 3:4، بلا زوايا، عدد المشاهدات في الأسفل
export const ReelTile = ({ video, onClick, dimmed = false }) => {
  const [failed, setFailed] = useState(false)
  return (
    <button type="button" onClick={onClick} aria-label={video.title || 'تشغيل الفيديو'}
      className="group relative aspect-[3/4] w-full overflow-hidden bg-gray-900 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white">
      {video.coverImageUrl && !failed ? (
        <img src={video.coverImageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}
          className={`absolute inset-0 w-full h-full object-cover transition duration-300 group-hover:scale-105 ${dimmed ? 'opacity-40 grayscale' : ''}`} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center"><TikTokLogo className="w-9 h-9 opacity-50" /></span>
      )}

      {/* تظليل خفيف في الأسفل ليظهر العدد على أي غلاف */}
      <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />

      <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 text-[12px] sm:text-sm text-white font-semibold drop-shadow" dir="ltr">
        <Play size={13} strokeWidth={2.5} />{compactCount(video.viewCount)}
      </span>

      {video.product && (
        <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-white/90 text-gray-900 flex items-center justify-center shadow-sm" title="مرتبط بمنتج">
          <ShoppingBag size={13} />
        </span>
      )}

      {dimmed && (
        <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold">
          <EyeOff size={11} />مخفي
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
