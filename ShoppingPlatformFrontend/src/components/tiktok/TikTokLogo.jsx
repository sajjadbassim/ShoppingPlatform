// شعار تيك توك (ألوان العلامة الرسمية)
const TikTokLogo = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#25F4EE" d="M19.5 20.1v-2a14 14 0 0 0-1.9-.1 14.6 14.6 0 0 0-8.4 26.6 14.6 14.6 0 0 1 10.3-24.5z" />
    <path fill="#25F4EE" d="M19.9 42.3a6.7 6.7 0 0 0 6.7-6.4V4.4h5.7a10.8 10.8 0 0 1-.2-2H24v31.4a6.7 6.7 0 0 1-6.7 6.4 6.6 6.6 0 0 1-3.1-.8 6.7 6.7 0 0 0 5.7 2.9zM42.6 15.2v-1.9a10.8 10.8 0 0 1-6-1.8 11 11 0 0 0 6 3.7z" />
    <path fill="#FE2C55" d="M36.6 11.5a10.9 10.9 0 0 1-2.7-7.1h-2.2a11 11 0 0 0 4.9 7.1zM17.6 27a6.7 6.7 0 0 0-3.1 12.6 6.7 6.7 0 0 1 5.4-10.6 6.5 6.5 0 0 1 2 .3v-8a14 14 0 0 0-1.9-.1h-.4v6.1a6.5 6.5 0 0 0-2-.3z" />
    <path fill="#FE2C55" d="M42.6 15.2v6.1a18.8 18.8 0 0 1-11-3.5v16a14.6 14.6 0 0 1-22.7 12.1 14.6 14.6 0 0 0 25.3-9.9V20a18.8 18.8 0 0 0 11 3.5v-7.8a11 11 0 0 1-2.6-.5z" />
    <path fill="#fff" d="M31.6 34V18a18.8 18.8 0 0 0 11 3.5v-6.1a11 11 0 0 1-6-3.7 11 11 0 0 1-4.9-7.1h-5.7v31.3a6.7 6.7 0 0 1-12.2 3.7 6.7 6.7 0 0 1 3.1-12.6 6.5 6.5 0 0 1 2 .3v-6.1a14.6 14.6 0 0 0-10.3 24.6A14.6 14.6 0 0 0 31.6 34z" />
  </svg>
)

export default TikTokLogo

// اسم المستخدم من رابط الفيديو (https://www.tiktok.com/@user/video/…) — متاح دون صلاحية user.info.profile
export const usernameFromVideos = (videos = []) => {
  for (const v of videos) {
    const match = v.shareUrl?.match(/tiktok\.com\/@([^/?#]+)/i)
    if (match) return decodeURIComponent(match[1])
  }
  return null
}

export const compactCount = (n) =>
  n == null ? '—' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n)
