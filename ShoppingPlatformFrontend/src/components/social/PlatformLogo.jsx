import TikTokLogo from '../tiktok/TikTokLogo'
import InstagramLogo from './InstagramLogo'

export const PLATFORM_NAMES = { tiktok: 'TikTok', instagram: 'Instagram' }

// شعار المنصة حسب platform في عناصر المحتوى ('tiktok' | 'instagram')
const PlatformLogo = ({ platform, className }) =>
  platform === 'instagram' ? <InstagramLogo className={className} /> : <TikTokLogo className={className} />

export default PlatformLogo
