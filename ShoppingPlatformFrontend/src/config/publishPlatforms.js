import { apiGet } from '../api/axios'
import { API_ENDPOINTS } from '../api/endpoints'
import InstagramLogo from '../components/social/InstagramLogo'
import TikTokLogo from '../components/tiktok/TikTokLogo'

// منصات النشر التي لها سجل منشورات — علامة «منشور على» في قائمة المنتجات تُبنى من هذه القائمة
// إضافة منصة جديدة = سطر هنا (نقطة قائمة المنشورات يجب أن تعيد { productId, status })
export const PUBLISH_PLATFORMS = {
  instagram: { label: 'إنستغرام', Logo: InstagramLogo, postsUrl: API_ENDPOINTS.INSTAGRAM.POSTS },
  tiktok: { label: 'تيك توك', Logo: TikTokLogo, postsUrl: API_ENDPOINTS.TIKTOK.POSTS },
}

// productId ← مفاتيح المنصات التي نُشر عليها فعلاً (من آخر 50 منشوراً لكل منصة)
export const fetchPublishedMap = async () => {
  const entries = Object.entries(PUBLISH_PLATFORMS)
  const lists = await Promise.all(entries.map(async ([, { postsUrl }]) => {
    try { return (await apiGet(postsUrl)).data?.data || [] } catch { return [] }
  }))
  const map = {}
  entries.forEach(([key], i) => lists[i].forEach(post => {
    if (post.status !== 'PUBLISHED' || !post.productId) return
    const keys = (map[post.productId] ||= [])
    if (!keys.includes(key)) keys.push(key)
  }))
  return map
}
