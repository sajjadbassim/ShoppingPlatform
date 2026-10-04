import TikTokLogo from '../tiktok/TikTokLogo'
import InstagramLogo from './InstagramLogo'
import FacebookLogo from './FacebookLogo'

export const PLATFORM_NAMES = { tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook' }

// شعار المنصة حسب platform في عناصر المحتوى ('tiktok' | 'instagram' | 'facebook')
const PlatformLogo = ({ platform, className }) =>
  platform === 'instagram' ? <InstagramLogo className={className} />
    : platform === 'facebook' ? <FacebookLogo className={className} />
    : <TikTokLogo className={className} />

export default PlatformLogo
