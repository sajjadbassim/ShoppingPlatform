import { useState } from 'react'
import { getImageUrl } from '../../utils/imageHelper'

// رموز احتياطية حسب اسم الفئة، وإلا حسب الترتيب
const EMOJI_BY_KEYWORD = [
  ['إلكترون', '📱'], ['أزياء', '👕'], ['ملابس', '👕'], ['رياض', '⚽'], ['منزل', '🏠'],
  ['سوبرماركت', '🛒'], ['بقال', '🛒'], ['صحة', '💄'], ['جمال', '💄'], ['كتب', '📚'],
  ['قرطاس', '📚'], ['ألعاب', '🎮'], ['ترفيه', '🎮'], ['سيار', '🚗'], ['حيوان', '🐾'],
  ['أطفال', '🧸'], ['طعام', '🍽️'], ['عطور', '🌸'],
]
const FALLBACK_EMOJIS = ['🛍️', '📦', '🎁', '✨']

export const categoryEmoji = (name = '', index = 0) =>
  EMOJI_BY_KEYWORD.find(([k]) => name.includes(k))?.[1] || FALLBACK_EMOJIS[index % FALLBACK_EMOJIS.length]

/**
 * أيقونة فئة مع بديل تلقائي:
 * بعض الأيقونات المرفوعة صورة 1×1 بكسل (تظهر مربعاً أسود) أو رابط معطوب،
 * فنعرض رمزاً مناسباً بدلها
 */
const CategoryIcon = ({ category, index = 0, className = 'w-8 h-8', emojiClassName = 'text-2xl' }) => {
  const [failed, setFailed] = useState(false)
  const src = category?.iconUrl ? getImageUrl(category.iconUrl) : null

  if (!src || failed) {
    return (
      <span className={`${emojiClassName} leading-none`} aria-hidden="true">
        {categoryEmoji(category?.nameAr || category?.name, index)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={`${className} object-contain`}
      onError={() => setFailed(true)}
      onLoad={(e) => { if (e.currentTarget.naturalWidth <= 2 || e.currentTarget.naturalHeight <= 2) setFailed(true) }}
    />
  )
}

export default CategoryIcon
