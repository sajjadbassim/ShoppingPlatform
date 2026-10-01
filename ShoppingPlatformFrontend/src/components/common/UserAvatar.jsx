import { useState, useEffect } from 'react'
import { getImageUrl } from '../../utils/imageHelper'

// صورة المستخدم الشخصية، أو الحرف الأول من اسمه إن لم تكن له صورة
const UserAvatar = ({ user, className = 'w-9 h-9', textClassName = 'text-primary font-semibold text-sm', bgClassName = 'bg-primary/10', fallback = 'م' }) => {
  const src = getImageUrl(user?.avatarUrl)
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])

  if (src && !broken) {
    return (
      <img src={src} alt={user?.fullName || ''} onError={() => setBroken(true)}
        className={`${className} rounded-full object-cover flex-shrink-0`} />
    )
  }
  return (
    <span className={`${className} ${bgClassName} rounded-full flex items-center justify-center flex-shrink-0`}>
      <span className={textClassName}>{user?.fullName?.trim()?.charAt(0) || user?.phone?.charAt(0) || fallback}</span>
    </span>
  )
}

export default UserAvatar
